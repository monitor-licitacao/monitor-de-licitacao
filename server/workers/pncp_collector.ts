/**
 * feat(worker): pncp-collector-dynamic
 * Worker responsável por extrair dados reais da API oficial do PNCP.
 * Agora é MULTI-TENANT e MULTI-NCM. Ele busca as regras ativas de cada cliente
 * no banco de dados e filtra os editais encontrados com base no NCM ou Keywords.
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import { Agent, fetch as undiciFetch } from 'undici';
import { decryptSecret } from '../lib/crypto';
import {
  applyClientSideFilters,
  buildPublicationQuery,
  DEFAULT_PNCP_MODALIDADES,
  formatPncpDate,
  matchTenantsForItem,
  normalizePncpItem,
  type PncpRawItem,
  type TenantMatchRule,
} from '../lib/pncpClient';

type TenantRule = TenantMatchRule & {
  pncpConfig?: {
    certificatePath?: string;
    certificatePassword?: string;
    isActive?: boolean;
  };
};

async function runCollector() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ ERRO: DATABASE_URL não configurada.');
    process.exit(1);
  }

  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  // 1. Carrega todos os tenants e suas respectivas configurações e NCMs
  const tenants = await db.select().from(schema.tenants);
  if (tenants.length === 0) {
    console.error('❌ Nenhum tenant encontrado no banco.');
    process.exit(1);
  }

  const tenantRules: TenantRule[] = [];
  
  for (const tenant of tenants) {
    // Busca NCMs ativos
    const ncms = await db.select().from(schema.tenantNcms)
      .where(eq(schema.tenantNcms.tenantId, tenant.id));
    const activeNcms = ncms.filter(n => n.active).map(n => n.code.trim().toLowerCase());

    // Busca Keywords
    const configs = await db.select().from(schema.tenantConfigs)
      .where(eq(schema.tenantConfigs.tenantId, tenant.id));
    let keywords: string[] = [];
    let pncpConfig;
    if (configs.length > 0) {
      if (configs[0].searchKeywords) {
        keywords = configs[0].searchKeywords.map((k: string) => k.toLowerCase().trim());
      }
      pncpConfig = configs[0].pncpConfig;
    }

    tenantRules.push({
      tenantId: tenant.id,
      keywords,
      ncms: activeNcms,
      pncpConfig
    });
  }

  const sourceId = 'src-pncp-api-01'; 

  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  
  const dataInicialLabel = formatPncpDate(thirtyDaysAgo);
  const dataFinalLabel = formatPncpDate(today);

  console.log(`🚀 Iniciando Coletor PNCP Dinâmico [${dataInicialLabel} a ${dataFinalLabel}]`);
  console.log(`🏢 Carregadas regras para ${tenantRules.length} tenants ativos.`);

  let newInsertions = 0;

  // Pré-carrega o certificado e configura o dispatcher global do PNCP
  // (Lê o disco uma única vez antes dos loops, ao invés de ler por página)
  let dispatcher: Agent | undefined;
  const tenantWithCert = tenantRules.find(r => r.pncpConfig?.isActive && r.pncpConfig?.certificatePath);
  
  if (tenantWithCert && tenantWithCert.pncpConfig) {
    try {
      console.log(`  🔒 Carregando certificado do tenant ${tenantWithCert.tenantId} para coleta global...`);
      const certData = fs.readFileSync(tenantWithCert.pncpConfig.certificatePath!);
      dispatcher = new Agent({
        connect: {
          pfx: certData,
          passphrase: decryptSecret(tenantWithCert.pncpConfig.certificatePassword || ''),
          rejectUnauthorized: true, // Garante validação da cadeia do governo
        }
      });
      console.log(`  ✅ Certificado mTLS pronto.`);
    } catch (certErr: any) {
      console.log(`  ⚠️ Erro ao ler certificado mTLS do tenant ${tenantWithCert.tenantId}: ${certErr.message}`);
    }
  }

  for (const modalidade of DEFAULT_PNCP_MODALIDADES) {
    console.log(`\n🔍 Buscando modalidade ${modalidade}...`);
    let page = 1;
    let keepSearching = true;

    while (keepSearching && page <= 5) { // Limite de paginação
      const { url, clientSideFilters } = buildPublicationQuery({
        dataInicial: thirtyDaysAgo,
        dataFinal: today,
        modalidade,
        pagina: page,
        tamanhoPagina: 50,
      });

      try {
        // O Agent (dispatcher) já foi instanciado fora do loop principal,
        // garantindo que não vamos ler o arquivo de certificado do disco a cada página.

        const res = await undiciFetch(url.toString(), {
          headers: { 'Accept': 'application/json', 'User-Agent': 'Monitor-Editais-Worker-V2/1.0' },
          dispatcher: dispatcher,
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          console.log(`  ⚠️ Erro HTTP ${res.status}. Interrompendo modalidade ${modalidade}.`);
          break;
        }

        const data: { data?: PncpRawItem[] } = await res.json();
        const rawItems: PncpRawItem[] = data?.data || [];
        const items = applyClientSideFilters(rawItems, clientSideFilters);

        if (rawItems.length === 0) {
          keepSearching = false;
          break;
        }

        console.log(`  [Página ${page}] Lidos ${rawItems.length} registros (${items.length} após filtros)...`);

        for (const item of items) {
          const tenantMatches = matchTenantsForItem(item, tenantRules);

          for (const match of tenantMatches) {
            const draft = normalizePncpItem(item, tenantRules.find(r => r.tenantId === match.tenantId)?.ncms[0] ?? 'N/A');

            try {
              await db.insert(schema.editais).values({
                id: draft.id,
                tenantId: match.tenantId,
                sourceId,
                processNumber: draft.processNumber,
                title: draft.title,
                sourceName: 'PNCP (Portal Nacional)',
                sourceCategory: 'Federal',
                ncmCode: draft.ncmCode,
                objectDescription: draft.objectDescription,
                url: draft.url,
                rawUrl: draft.rawUrl,
                status: 'OPEN',
                agency: draft.agency,
                estimatedValue: draft.estimatedValue,
                publishedAt: draft.publishedAt,
                biddingDate: draft.biddingDate,
                humanReviewStatus: 'PENDING',
              }).onConflictDoNothing();

              console.log(`    ✅ [TENANT ${match.tenantId}] Match [${match.matchType}]: Salvo ${draft.id} (${match.matchedTerm})`);
              newInsertions++;
            } catch (dbErr: any) {
              console.log(`    ⚠️ Erro DB: ${dbErr.message}`);
            }
          }
        }
      } catch (fetchErr: any) {
        console.log(`  ❌ Falha de rede: ${fetchErr.message}`);
        break; 
      }
      
      page++;
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  try {
    await db.update(schema.sources)
      .set({ 
        lastCheckedAt: new Date(), 
        totalCollected: newInsertions,
        status: 'ACTIVE'
      })
      .where(eq(schema.sources.id, sourceId));
  } catch (e) {
    // silently fail metrics update
  }

  console.log('\n════════════════════════════════════════════════');
  console.log(`🎉 Worker dinâmico finalizado! ${newInsertions} novos editais salvos.`);
}

import cron from 'node-cron';

// Verifica se rodará via Cron (em produção) ou direto (manual)
const isCron = process.env.WORKER_CRON === 'true';

if (isCron) {
  console.log('⏳ Iniciando orquestração Cron para PNCP (Executando a cada 4 horas)...');
  // Executa a cada 4 horas
  cron.schedule('0 */4 * * *', async () => {
    try {
      await runCollector();
    } catch (e) {
      console.error('❌ Erro no job cron PNCP:', e);
    }
  });
  
  // Roda uma vez ao iniciar
  runCollector().catch(console.error);
} else {
  runCollector().then(() => {
    process.exit(0);
  }).catch(e => {
    console.error(e);
    process.exit(1);
  });
}
