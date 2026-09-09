# Relatório de Curadoria e Inventário de Fontes de Licitação

## 1. Contexto e Objetivo
Este documento consolida a curadoria, validação técnica e mapeamento de URLs funcionais para o pipeline de monitoramento de editais de compras públicas, cobrindo:
1. **Compras RJ (Portal de Compras do Estado do Rio de Janeiro - SIGA / Struts2 / Solr / DataTables AJAX)**
2. **Portais Integrados ao PNCP (Portal Nacional de Contratações Públicas - 341 portais mapeados e categorizados)**
3. **Amostra de Editais e Itens/Lotes do Compras RJ (100 licitações e 304 itens)**
4. **Sistema S Nacional e Regionais (SESI, SENAI, SESC, SEST/SENAT - 26 fontes mapeadas)**

---

## 2. Inventário de Rede e Chamadas Funcionais — Compras RJ (`www.compras.rj.gov.br.har`)

### 2.1 Visão Geral da Análise de Rede (DevTools Fetch/XHR)
O tráfego capturado no arquivo HAR continha **52 entradas de rede**. A auditoria identificou claramente o que é ativo estático, telemetria/rastreamento e endpoints funcionais de negócio:

- **Total de Requisições:** 52
- **Documento Principal (HTML):** 1 (`/Catalogo/buscar.action` - 48.8 KB)
- **Chamadas Dinâmicas Funcionais (XHR):**
  - `GET /Noticias/listarSuporteUsuario` (HTTP 200, JSON, 219 B, 42.7 ms) — Dados de suporte e monitoramento.
  - `GET /Catalogo/carregaFamilia.action?ramoAtividade.idTipo=1` (HTTP 200, JSON, 13.0 KB, 278.3 ms) — Carregamento dinâmico da taxonomia de materiais.
- **Requisições de Telemetria e Analytics (A serem descartadas no coletor):**
  - `POST https://www.google-analytics.com/g/collect` (HTTP 204, Fetch)
  - `GET https://www.googletagmanager.com/gtag/js` (HTTP 200, Script)
  - `GET https://core.service.elfsight.com/p/boot/` (HTTP 304, XHR de widget terceiro)
  - `POST https://gator.volces.com/list` (HTTP 200, XHR injetado por extensão de navegador do operador)
- **Recursos Estáticos:** 18 scripts, 15 imagens, 6 fontes, 5 folhas de estilo.

### 2.2 Inventário de Endpoints Funcionais Identificados (Compras RJ)
Consolidado no arquivo versionado `curadoria/endpoints_compras_rj_api.json`:

| ID Endpoint | URL | Método | Formato Req/Resp | Finalidade e Recomendações |
| :--- | :--- | :--- | :--- | :--- |
| `compras_rj_licitacoes_paginate` | `/EditaisLicitacoes/paginate.action` | POST | Form-urlencoded / JSON | **Endpoint Crítico:** Busca paginada via DataTables AJAX. Suporta filtros por `idAndamento=2`, `filtro.objetoLic`, datas de publicação e limite de propostas. Conector recomendado: `HTTP_API_REST`. |
| `compras_rj_licitacao_detalhar` | `/EditaisLicitacoes/detalhar.action` | GET | Query params / HTML | **Detalhamento & Anexos:** Recebe `idLic=<id>` e retorna o edital completo, anexos para download, lotes e cronograma. |
| `compras_rj_catalogo_paginate` | `/Catalogo/paginate.action` | GET/POST | Form-urlencoded / JSON | Pesquisa paginada de itens e materiais do catálogo SIGA. |
| `compras_rj_catalogo_familia` | `/Catalogo/carregaFamilia.action` | GET | Query params / JSON | Árvore taxonômica de famílias de compras públicas. |
| `compras_rj_catalogo_classe` | `/Catalogo/carregaClasse.action` | GET | Query params / JSON | Classes de produtos por família. |
| `compras_rj_catalogo_artigo` | `/Catalogo/carregaArtigo.action` | GET | Query params / JSON | Artigos de compras públicas (subdivisão de classe). |
| `compras_rj_catalogo_detalhar` | `/Catalogo/detalhar.action` | GET | Query params / HTML | Ficha técnica completa do item, sustentabilidade e banco de preços históricos. |
| `compras_rj_atas_registro_preco` | `/AtaRegistroPreco/buscar.action` | GET | HTML / DataTables | Consulta pública de Atas de Registro de Preço. |
| `compras_rj_compra_direta` | `/CompraDireta/buscar.action` | GET | HTML / DataTables | Mural de dispensas e compras diretas do RJ. |
| `compras_rj_dispensa_eletronica` | `/ProcessoEletronicoDispensa/buscar.action` | GET | HTML / DataTables | Cotações eletrônicas e processos de dispensa. |
| `compras_rj_suporte` | `/Noticias/listarSuporteUsuario` | GET | JSON | Endpoint leve de healthcheck e status de atendimento. |

---

## 3. Curadoria dos Portais Integrados ao PNCP (`curadoria/portais_integrados_pncp_curados.csv`)

A base oficial de integração do PNCP contém **341 portais cadastrados**. A análise revelou a real arquitetura do ecossistema de compras públicas no Brasil:

### 3.1 Distribuição por Categoria e Esfera
- **Software Houses / GovTechs de ERP Municipal (148 portais / 43.4%):** Fornecedores que integram os sistemas das prefeituras diretamente ao PNCP via API (ex: Betha, IPM Atende.Net, Fiorilli SCPI, Elotech, Megasoft, GovBR, Centi, Conam).
- **Prefeituras e Câmaras Municipais (63 portais / 18.5%):** Entidades municipais individuais com envio direto ao PNCP.
- **Entidades e Empresas Públicas Municipais/Estaduais (66 portais / 19.3%):** SAAEs, empresas de saneamento, companhias de desenvolvimento e fundações.
- **Governos Estaduais e Secretarias Centrais (20 portais / 5.9%):** Portais centrais dos estados (ex: Compras RJ, Compras MG, Compras Pará, SUPEL Rondônia, SEPLAG Ceará, SAD Pernambuco).
- **Poder Judiciário e Tribunais de Contas (31 portais / 9.1%):** TJs estaduais (TJSP, TJPR, TJMT) e TCEs (TCE-RS Licitacon, TCE-ES).
- **Plataformas e Bolsas Privadas de Licitação (10 portais / 2.9%):** As plataformas de maior volume nacional que agregam milhares de prefeituras (Portal de Compras Públicas / Ecustomize, BLL Compras, BBMNet, BNC, Licitar Digital, Licitanet, Licitações-e BB).
- **Governo Federal (2 portais / 0.6%):** Compras.gov.br e Contratos.gov.br.
- **Conselhos Profissionais (1 portal / 0.3%):** CREA-PR.

### 3.2 Estratégia de Conectores e Reuso
1. **Prioridade 1 — Grandes Plataformas Privadas e Federais (Maior ROI):**
   - **Compras.gov.br (Federal):** API REST oficial aberta.
   - **BLL Compras, BBMNet, Portal de Compras Públicas, Licitar Digital, BNC:** Portais agregadores que cobrem mais de 4.000 municípios.
2. **Prioridade 2 — Portais Centrais Estaduais:**
   - **Compras RJ:** Conector direto via DataTables AJAX `/EditaisLicitacoes/paginate.action` (mapeado nesta curadoria) ou ingestão via API PNCP (`cnpj=15829998000109`).
   - **Minas Gerais, Pará, Ceará, Pernambuco:** Portais com padronização estadual.
3. **Prioridade 3 — Software Houses / GovTechs:**
   - As 148 software houses municipais enviam dados padronizados para o PNCP. O conector **PNCP API de Consulta** (`/api/consulta/v1/contratacoes/publicacao?cnpj=...`) unifica a captura dessas prefeituras sem a necessidade de construir 148 scrapers distintos.

---

## 4. Curadoria Sistema S (`curadoria/sistema_s_fontes_dados_abertos.csv`)

### 4.1 Principais Diretrizes Técnicas
1. **Ausência de API Nacional Única (exceto SEST/SENAT):** SESI, SENAI e SESC são federados por estado.
2. **Plataforma Paradigma Business Solutions:**
   - Detectada em múltiplos portais transacionais: SEST/SENAT, SESC DN, SESC-SP, SESC+SENAC-RS, SESI+SENAI-RS (FIERGS).
   - Reuso imediato da arquitetura reversa-engenheirada de postback ASP.NET (`Mural.aspx` / `trListaMuralProcesso_Click` / `btBaixaAnexo`).
3. **Regra de Validação de URLs:** Rejeição rigorosa de domínios descontinuados/falsos (como `licitacoes.sesc.com.br` e `sestsenat.org.br/licitacoes-e-compras`), redirecionando para os murais canônicos.

---

## 5. Arquivos Gerados e Versionados no Repositório

| Arquivo | Descrição |
| :--- | :--- |
| `curadoria/inventario_compras_rj_devtools_har.csv` | Inventário completo das 52 requisições do HAR com colunas Nome, URL, Status, Esquema, Domínio, Tipo, Iniciador, Tamanho, Tempo e Recomendação de Filtro. |
| `curadoria/inventario_compras_rj_devtools_har.json` | Versão estruturada em JSON do inventário de chamadas de rede do Compras RJ. |
| `curadoria/endpoints_compras_rj_api.json` | Catálogo técnico dos 11 endpoints funcionais de licitações, catálogo e atas do Compras RJ com parâmetros e tipos de conectores recomendados. |
| `curadoria/portais_integrados_pncp_curados.csv` | Tabela com 341 portais do PNCP curados, classificados por esfera, tecnologia, URLs canônicas e endpoint da API PNCP. |
| `curadoria/portais_integrados_pncp_curados.json` | Versão JSON completa da base curada de portais integrados ao PNCP. |
| `curadoria/editais_compras_rj_amostra.csv` | Amostra de 100 licitações públicas extraídas do Compras RJ com modalidade, unidade e cronograma. |
| `curadoria/itens_lotes_compras_rj_amostra.csv` | Amostra de 304 itens e lotes com código do item SIGA, descrição e quantidade. |
| `curadoria/editais_licitacoes_compras_rj.json` | Estrutura unificada de licitações e seus respectivos lotes/itens em JSON. |
| `curadoria/sistema_s_fontes_dados_abertos.csv` | 26 fontes mapeadas do Sistema S com tipo de acesso e grau de confiança. |
| `curadoria/curadoria_sistema_s_dados_abertos.md` | Documento com os 3 achados estruturais e diretrizes de extração do Sistema S. |
| `server/lib/pncpSourcesCatalog.ts` | Módulo TypeScript com tipos, constantes e funções utilitárias para consulta e teste de portais do PNCP no backend. |
