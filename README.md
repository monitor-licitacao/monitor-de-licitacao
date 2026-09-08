# Monitor de Licitações

A plataforma **Monitor de Licitações** permite acompanhar editais públicos, analisar documentos, detectar inconformidades e gerar relatórios executivos.

## Features
- Scraping de portais de licitações (ComprasNet, SESC, etc.) usando Puppeteer e Playwright.
- OCR e extração de texto com Tesseract.
- Análise de conformidade baseada em regras de ouro (veja `GOLDEN_RULES.md`).
- Geração de PDFs detalhados (`src/utils/pdfGenerator.ts`).
- Interface React com painéis de métricas, pipeline hygiene e ação sobre negócios estagnados.
- Backend Node/Express + Drizzle ORM conectado ao PostgreSQL serverless Neon.
- Integração de notificações via WhatsApp.

## Project structure
```
src/
  App.tsx                # Entry point
  components/            # React UI components
  data/                  # Dados iniciais (mock)
  utils/                 # Helpers (pdf generation, etc.)
  types.ts               # TypeScript types shared across app
  main.tsx               # Server entry (Express API)
```

## Getting Started
```bash
# Install dependencies
npm install

# Run development server (watch mode)
npm run dev
```

The dev server starts the API (Express) and the React app on the same process via `tsx`.

## Scripts
- `npm run dev` – Starts dev mode with hot reloading.
- `npm run build` – Builds the Vite bundle and the server bundle.
- `npm run start` – Runs the production build.
- `npm run check-health` – Executes `scripts/check-health.sh` which runs lint and type‑check.
- `npm run auto-ship` – Runs `scripts/auto-ship.sh` (pre‑commit checks, lint‑staged, commit‑cz, push).

## Documentation
- **Golden Rules** – `GOLDEN_RULES.md`
- **Workflow Grok Mem** – `docs/WORKFLOW_GROKMEM.md`
- **Neon best‑practice** – `docs/NEON_RULES.md`
- **Product requirement docs** – `docs/*.md`

## Contributing
1. Fork the repo.
2. Create a feature branch (`git checkout -b feat/your‑feature`).
3. Follow the Conventional Commits format for commits.
4. Run `npm run check-health` before pushing.
5. Open a Pull Request targeting `main`.

## License
This project is proprietary and intended for internal use by the organization. See the repository’s legal notice for details.
