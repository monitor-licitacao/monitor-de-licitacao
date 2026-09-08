# =============================================================================
# Monitor de Licitações — Dockerfile de produção
# =============================================================================
# Build multi-stage:
#   1) deps-build: instala TODAS as deps (precisa de devDeps p/ vite/esbuild) e
#      gera o build (vite build do frontend + esbuild bundle do server.ts).
#   2) deps-prod:  instala só as deps de produção (menor superfície/imagem).
#   3) runtime:    imagem final, sem toolchain de build, roda como usuário não-root.
#
# Importante: `npm run build` gera o server bundle com esbuild usando
# `--packages=external` (ver package.json), ou seja, o bundle NÃO inclui os
# node_modules — ele espera encontrá-los em runtime. Por isso a imagem final
# copia node_modules de produção (stage deps-prod) além de dist/.
#
# Base: node:20-bookworm-slim (Debian), NÃO Alpine — evita os problemas
# clássicos de libc musl x glibc caso os workers com Puppeteer (já existem no
# código: server/workers/pncp_collector.ts, scraper_puppeteer_sesc.ts,
# sesc_sp_scraper.ts) passem a rodar neste container no futuro.
#
# Por enquanto esses workers NÃO rodam aqui (são scripts npm separados,
# `worker:pncp` / `worker:sescsp`, disparados manualmente — server.ts não os
# importa). Por isso PUPPETEER_SKIP_DOWNLOAD evita baixar ~300MB de Chromium
# à toa em toda imagem; quando os workers forem incluídos neste deploy,
# remover essa variável e instalar as libs de sistema que o Chromium exige.
# =============================================================================

FROM node:20-bookworm-slim AS deps-build
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS deps-prod
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

# Usuário não-root (a imagem oficial node:* já traz o usuário "node", uid 1000)
COPY --from=deps-prod --chown=node:node /app/node_modules ./node_modules
COPY --from=deps-build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

USER node
EXPOSE 3000

# Healthcheck local ao container — o server expõe GET /api/health, liberado
# sem x-api-key pelo middleware em server.ts (checa req.path === '/health'
# relativo ao mount point '/api').
HEALTHCHECK --interval=30s --timeout=5s --retries=5 --start-period=20s \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/health', r => process.exit(r.statusCode===200?0:1)).on('error', () => process.exit(1))"

CMD ["node", "dist/server.cjs"]
