# PNCP Arquivos + Histórico — Plano de Persistência

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persistir e exibir anexos (`/arquivos`) e histórico PNCP (`/historico`) na ficha de contratação, corrigindo o estado atual em que Passex 19732 mostra **Anexos (0)** apesar de 4 PDFs publicados no PNCP.

**Architecture:** Cliente HTTP PNCP paginado → upsert idempotente em Postgres → `getContratacaoDetail` lê tabelas persistidas (com sync lazy se vazio/stale). Histórico PNCP fica em tabela dedicada (shape fiel ao portal); eventos derivados existentes (`contratacao_historico`) permanecem para vigência/contratos.

**Tech Stack:** Node/tsx, postgres.js, Drizzle migrations SQL, testes `node --import tsx --test`, React (ContratacaoDetailView).

## Global Constraints

- Hosts permitidos: `pncp.gov.br` apenas (sem download de blob para storage próprio — link direto PNCP).
- Idempotência: re-sync não duplica linhas.
- Golden de validação: Passex 19732 (`00394452000103-1-019732/2026`, UUID local `cf9e0e18-1b03-4cb2-9f29-ad964c869402`).
- Endpoints oficiais:
  - `GET /api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{seq}/arquivos/quantidade` → `4`
  - `GET /api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{seq}/arquivos?pagina=1&tamanhoPagina=50`
  - `GET /api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{seq}/historico?pagina=1&tamanhoPagina=50`
- `npm test` + `npm run lint` verdes antes do merge.

---

## Diagnóstico (estado atual)

| Camada | Comportamento atual | Gap |
|--------|---------------------|-----|
| Ingest | `ingestContratacaoBundle` persiste compra + itens | Não chama `/arquivos` nem `/historico` |
| Detail API | `buildAnexos(rawJson)` | `raw_json` da compra **não** inclui `arquivos[]` |
| Detail API | `listHistorico` | Só 3 eventos **derivados** (publicação/propostas); ignora 38 logs PNCP |
| UI | Tab Anexos | Lista vazia para Passex 19732 |

---

## File Map

| Arquivo | Responsabilidade |
|---------|------------------|
| `server/db/migrations/0011_contratacao_arquivos.sql` | Tabela `contratacao_arquivo` |
| `server/db/migrations/0012_contratacao_log_pncp.sql` | Tabela `contratacao_log_pncp` |
| `server/lib/pncp/types.ts` | DTOs `PncpArquivoDto`, `PncpHistoricoLogDto` |
| `server/lib/pncp/arquivos-client.ts` | Fetch quantidade + páginas arquivos/histórico |
| `server/lib/pncp/persist-arquivos.ts` | Upsert + list por contratacao_id |
| `server/lib/pncp/persist-historico-pncp.ts` | Upsert + list paginado |
| `server/lib/pncp/sync-documentos.ts` | Orquestra sync (quantidade → páginas → persist) |
| `server/lib/pncp/ingest.ts` | Chamar sync pós-upsert contratação |
| `server/lib/compras-gov/enrichment-api.ts` | Lazy sync + montar `anexos`/`historico` UI |
| `server/lib/compras-gov/normalize-contratacao-detail.ts` | Fallback buildAnexos se DB vazio |
| `server/lib/pncp/fixtures/passex-19732/pncp-arquivos-p1.json` | Golden 4 docs |
| `server/lib/pncp/fixtures/passex-19732/pncp-historico-p1.json` | Golden 5 logs (página 1) |
| `__pncp_arquivos__.test.ts` | Testes client + persist + detail |
| `src/components/contratacoes/ContratacaoDetailView.tsx` | UI tabela histórico estilo PNCP |

---

### Task 1: Migration `contratacao_arquivo`

**Files:**
- Create: `server/db/migrations/0011_contratacao_arquivos.sql`

**Interfaces:**
- Produces: tabela com UNIQUE `(contratacao_id, sequencial_documento)`

- [ ] **Step 1: Criar migration**

```sql
CREATE TABLE IF NOT EXISTS contratacao_arquivo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contratacao_id uuid NOT NULL REFERENCES contratacao(id) ON DELETE CASCADE,
  sequencial_documento integer NOT NULL,
  titulo text NOT NULL,
  tipo_documento_id integer,
  tipo_documento_nome text,
  tipo_documento_descricao text,
  url_download text NOT NULL,
  status_ativo boolean NOT NULL DEFAULT true,
  data_publicacao_pncp timestamptz,
  source text NOT NULL DEFAULT 'pncp_sync'
    CHECK (source IN ('pncp_sync', 'pncp_ingest')),
  raw_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contratacao_id, sequencial_documento)
);

CREATE INDEX IF NOT EXISTS contratacao_arquivo_contratacao_idx
  ON contratacao_arquivo (contratacao_id, sequencial_documento);
```

- [ ] **Step 2: Aplicar migration local** — `npm run db:migrate` (ou script existente do repo)

- [ ] **Step 3: Commit** — `feat(db): add contratacao_arquivo for PNCP documents`

---

### Task 2: Migration `contratacao_log_pncp`

**Files:**
- Create: `server/db/migrations/0012_contratacao_log_pncp.sql`

- [ ] **Step 1: Criar migration**

```sql
CREATE TABLE IF NOT EXISTS contratacao_log_pncp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contratacao_id uuid NOT NULL REFERENCES contratacao(id) ON DELETE CASCADE,
  tipo_log_nome text NOT NULL,
  categoria_nome text NOT NULL,
  evento_label text NOT NULL,
  documento_titulo text,
  documento_tipo text,
  documento_sequencial integer,
  item_numero integer,
  justificativa text,
  usuario_nome text,
  occurred_at timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'pncp_sync'
    CHECK (source IN ('pncp_sync', 'pncp_ingest')),
  raw_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (
    contratacao_id,
    occurred_at,
    categoria_nome,
    COALESCE(documento_sequencial, -1),
    COALESCE(item_numero, -1)
  )
);

CREATE INDEX IF NOT EXISTS contratacao_log_pncp_contratacao_idx
  ON contratacao_log_pncp (contratacao_id, occurred_at DESC);
```

- [ ] **Step 2: Commit** — `feat(db): add contratacao_log_pncp for PNCP maintenance logs`

---

### Task 3: DTOs + cliente HTTP

**Files:**
- Modify: `server/lib/pncp/types.ts`
- Create: `server/lib/pncp/arquivos-client.ts`
- Create: `server/lib/pncp/fixtures/passex-19732/pncp-arquivos-p1.json`
- Create: `server/lib/pncp/fixtures/passex-19732/pncp-historico-p1.json`
- Test: `__pncp_arquivos__.test.ts`

**Interfaces:**
- Produces: `fetchAllArquivos(cnpj, ano, seq)`, `fetchAllHistoricoPncp(cnpj, ano, seq)`, `fetchArquivosQuantidade(...)`

- [ ] **Step 1: Adicionar tipos**

```typescript
export type PncpArquivoDto = {
  sequencialDocumento: number;
  titulo: string;
  tipoDocumentoId?: number;
  tipoDocumentoNome?: string;
  tipoDocumentoDescricao?: string;
  url?: string;
  uri?: string;
  statusAtivo?: boolean;
  dataPublicacaoPncp?: string;
};

export type PncpHistoricoLogDto = {
  tipoLogManutencaoNome: string;
  categoriaLogManutencaoNome: string;
  logManutencaoDataInclusao: string;
  documentoTitulo?: string | null;
  documentoTipo?: string | null;
  documentoSequencial?: number | null;
  itemNumero?: number | null;
  justificativa?: string | null;
  usuarioNome?: string | null;
};
```

- [ ] **Step 2: Implementar client com paginação** (padrão igual `fetchItens` em `ingest.ts`)

- [ ] **Step 3: Teste com fixture Passex** — assert 4 arquivos, nomes Edital/TR/ETP/Mapa

- [ ] **Step 4: Commit** — `feat(pncp): client for arquivos and historico endpoints`

---

### Task 4: Persistência idempotente

**Files:**
- Create: `server/lib/pncp/persist-arquivos.ts`
- Create: `server/lib/pncp/persist-historico-pncp.ts`

**Interfaces:**
- Produces: `upsertArquivos(contratacaoId, arquivos[])`, `listArquivos(contratacaoId)`
- Produces: `upsertHistoricoPncp(contratacaoId, logs[])`, `listHistoricoPncp(contratacaoId, { limit, offset })`

- [ ] **Step 1: Normalizar URL download** — preferir `url` do payload; fallback `uri`; prefixo `https://pncp.gov.br/pncp-api/v1/...`

- [ ] **Step 2: Mapear histórico → `evento_label`** — `{tipoLogManutencaoNome} - {categoriaLogManutencaoNome}` (ex.: `Inclusão - Documento de Contratação`)

- [ ] **Step 3: Teste DB** — upsert 2x → count estável

- [ ] **Step 4: Commit** — `feat(pncp): persist arquivos and historico logs`

---

### Task 5: Sync orchestrator + hook no ingest

**Files:**
- Create: `server/lib/pncp/sync-documentos.ts`
- Modify: `server/lib/pncp/ingest.ts`

- [ ] **Step 1: `syncPncpDocumentos(contratacaoId, { cnpj, ano, sequencial })`**
  1. Fetch quantidade arquivos
  2. Paginar `/arquivos`
  3. Paginar `/historico` até esgotar
  4. Upsert ambos
  5. Retornar `{ arquivoCount, historicoCount }`

- [ ] **Step 2: Chamar ao final de `ingestContratacaoBundle`** (não falhar ingest se sync docs falhar — log + `source_health`)

- [ ] **Step 3: Commit** — `feat(pncp): sync documentos on ingest`

---

### Task 6: Detail API + lazy backfill

**Files:**
- Modify: `server/lib/compras-gov/enrichment-api.ts`
- Modify: `server/lib/compras-gov/normalize-contratacao-detail.ts` (fallback only)

- [ ] **Step 1: Em `getContratacaoDetail`**, se `listArquivos(id).length === 0`, chamar `syncPncpDocumentos` (timeout 15s, catch silencioso)

- [ ] **Step 2: Montar `detail.anexos`** a partir de `listArquivos`:

```typescript
{
  id: `arq-${sequencial_documento}`,
  nome: titulo,
  tipo: tipo_documento_nome ?? 'PDF',
  grupo: tipo_documento_nome ?? 'Processo',
  data_publicacao: formatDateTimeBR(data_publicacao_pncp) ?? '—',
  url_download: url_download,
}
```

- [ ] **Step 3: Montar `detail.historico_pncp`** (novo campo) OU mesclar em `historico` com flag `source: 'pncp_log'`

**Decisão recomendada:** estender `ContratacaoDetail.historico` com entradas PNCP **antes** dos derivados, ordenadas por `occurred_at` DESC. Campos extras opcionais: `documento_titulo`, `justificativa`, `item_numero`.

- [ ] **Step 4: Teste enrichment Passex** — `detail.anexos.length === 4`, tab count correto

- [ ] **Step 5: Commit** — `feat(api): expose persisted PNCP arquivos in contratacao detail`

---

### Task 7: UI — Anexos + Histórico estilo PNCP

**Files:**
- Modify: `src/types/contratacoes.ts`
- Modify: `src/components/contratacoes/ContratacaoDetailView.tsx`

- [ ] **Step 1: Anexos** — card com tipo documento, data publicação, botão Abrir (nova aba PNCP)

- [ ] **Step 2: Histórico** — tabela 4 colunas: Evento | Nome | Data/Hora | Justificativa (como screenshot PNCP)

- [ ] **Step 3: Paginação client-side** se >10 eventos (Passex tem 38)

- [ ] **Step 4: Commit** — `feat(ui): PNCP-style anexos and historico tabs`

---

### Task 8: Script backfill + npm script

**Files:**
- Create: `scripts/pncp_sync_documentos.ts`
- Modify: `package.json`

```bash
npm run pncp:sync-documentos -- --controle 00394452000103-1-019732/2026
```

- [ ] **Step 1: Script CLI** para backfill contratações já ingeridas

- [ ] **Step 2: Commit** — `chore(scripts): pncp sync documentos backfill`

---

### Task 9: Testes de integração + golden

**Files:**
- Create: `__pncp_arquivos__.test.ts`

Casos:
- Client parse fixture Passex (4 arquivos)
- `evento_label` = `Inclusão - Documento de Contratação` para Mapa de Riscos
- Detail API retorna anexos após sync (skip sem `DATABASE_URL`)
- Idempotência upsert

- [ ] **Step 1: Implementar testes**
- [ ] **Step 2: `npm test` verde**
- [ ] **Step 3: Commit** — `test(pncp): arquivos and historico persistence`

---

## Fora de escopo (issues futuras)

- Download/cache de PDFs em object storage
- Tab **Atas** (`/atas` — vazio no Passex)
- Tab **Contratos/Empenhos** (404 esperado até homologação)
- Sync captcha Compras.gov fase-externa

---

## Validação manual (Passex 19732)

1. `npm run pncp:sync-documentos -- --controle 00394452000103-1-019732/2026`
2. Abrir `http://localhost:3001/contratacoes/cf9e0e18-1b03-4cb2-9f29-ad964c869402`
3. Tab **Anexos** → 4 documentos (Edital, ETP, Mapa de Riscos, TR)
4. Tab **Histórico** → eventos `Inclusão - …` com datas 11/09/2026
5. Comparar com [PNCP edital 19732](https://pncp.gov.br/app/editais/00394452000103/2026/19732)

---

## Self-Review

- [x] Spec coverage: arquivos quantidade + lista + historico paginado + UI + ingest + backfill
- [x] Sem placeholders TBD
- [x] Tipos consistentes entre client → persist → API → UI
- [x] Golden Passex 19732 em todos os testes
