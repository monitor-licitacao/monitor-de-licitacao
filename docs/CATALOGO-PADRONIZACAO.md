# Catálogo de Padronização - Gov.br/PNCP

**Versão:** 1.0  
**Status:** Skeleton - Pronto para implementação  
**Fonte:** https://www.gov.br/pncp/pt-br/catalogo

## Visão Geral

O catálogo de padronização do gov.br apresenta itens padronizados para contratações públicas:

- **CATMAT:** Catálogo de Materiais (~3.000 itens)
- **CATSER:** Catálogo de Serviços (~2.000 itens)

Estes itens são usados em editais para padronização de especificações técnicas.

## Estrutura da Página

### URL Principal

```
https://www.gov.br/pncp/pt-br/catalogo
```

### Layout (típico)

```
┌─────────────────────────────────────────────────────────────┐
│ Header: Portal Nacional de Contratações Públicas            │
├─────────────────────────────────────────────────────────────┤
│ Navegação: Home > Catálogo > [CATMAT/CATSER]               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Abas/Links:                                                 │
│ - Catálogo de Materiais (CATMAT)                           │
│ - Catálogo de Serviços (CATSER)                            │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ Filtros:                                                    │
│ - Busca por termo                                          │
│ - Filtro por classificação                                 │
│ - Paginação                                                │
├─────────────────────────────────────────────────────────────┤
│ Tabela de Itens:                                           │
│ ┌──────┬─────────────┬──────────────────────────────────┐  │
│ │ Cod  │ CATMAT/SER  │ Descrição                        │  │
│ ├──────┼─────────────┼──────────────────────────────────┤  │
│ │ 0001 │ 110101      │ Papel A4 75g/m² - Branco        │  │
│ │ 0002 │ 110102      │ Papel A4 80g/m² - Branco        │  │
│ │ 0003 │ 110105      │ Papel Ofício 75g/m²             │  │
│ └──────┴─────────────┴──────────────────────────────────┘  │
│                                                              │
│ Links para documentos (PDFs, especificações)               │
│ - [Especificação Técnica]                                 │
│ - [Modelo de Termo de Referência]                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Parser Strategy

### 1. Identificação de Página

```typescript
// Verificar se é página de catálogo
const isKatalogPage = html.includes('Catálogo de Materiais') 
                       || html.includes('Catálogo de Serviços');
```

### 2. Extração de Tabelas

```typescript
// Usar cheerio para parser HTML
const $ = cheerio.load(html);

// Localizar tabelas (podem usar diferentes seletores)
const tables = $('table, .catalogo-table, [role="grid"]');

// Para cada tabela:
tables.each((idx, table) => {
  const rows = $(table).find('tbody tr, .row');
  
  rows.each((rowIdx, row) => {
    const cells = $(row).find('td, .cell');
    const item = {
      codigo: cells.eq(0).text().trim(),
      catmat: cells.eq(1).text().trim(),
      nome: cells.eq(2).text().trim(),
      descricao: cells.eq(3).text().trim(),
    };
  });
});
```

### 3. Normalização de Dados

```typescript
function normalizarItem(item: any): PncpItemPadronizado {
  return {
    id: uuidv4(),
    slug: slugify(item.nome),  // "papel-a4-75g-m2"
    nome: item.nome.trim(),
    codigosCatmat: [item.catmat].filter(c => c.startsWith('1')), // Se CATMAT
    codigosCatser: [item.catmat].filter(c => c.startsWith('2')), // Se CATSER
    descricao: item.descricao?.trim(),
    unidadeMedida: extractUnidade(item.descricao),  // "resma", "unidade"
    hashConteudo: sha256(JSON.stringify(item)),
    primeiraColetaEm: new Date(),
    ultimaColetaEm: new Date(),
  };
}
```

## Dados Esperados

### CATMAT (Catálogo de Materiais)

Exemplo de estrutura:

```sql
-- Código CATMAT começa com '1'
-- 110101 = Papel A4
-- 110102 = Papel Ofício
-- 110201 = Caneta azul
-- 120101 = Desktop
```

### CATSER (Catálogo de Serviços)

Exemplo de estrutura:

```sql
-- Código CATSER começa com '2'
-- 210101 = Serviços de limpeza
-- 210201 = Serviços de manutenção
-- 220101 = Serviços de TI
```

### Campos Extraíveis

```typescript
interface ItemExtraido {
  codigo: string;              // Número seqüencial
  codigoOrgao: string;         // CATMAT/CATSER
  nome: string;                // "Papel A4 75g/m²"
  descricao?: string;          // Detalhes técnicos
  especificacoes?: string;     // Requisitos mínimos
  unidadeMedida?: string;      // "resma", "unidade", "m²"
  precosReferencia?: number[]; // Se disponível
  documentos?: {               // Links para PDFs
    titulo: string;
    url: string;
    tipo: string;
  }[];
}
```

## Extração de Documentos

### Tipos de Documentos

1. **Especificação Técnica**
   - Arquivo: `CATMAT-110101-Especificacao.pdf`
   - Conteúdo: Requisitos técnicos mínimos

2. **Termo de Referência**
   - Arquivo: `CATMAT-110101-TR.pdf`
   - Conteúdo: Template para editais

3. **Modelo de Edital**
   - Arquivo: `CATMAT-110101-Edital.pdf`
   - Conteúdo: Exemplo de edital

### Download Strategy

```typescript
async function downloadDocumento(url: string, item: PncpItemPadronizado) {
  // 1. Validar URL
  if (!url.startsWith('https://')) return null;
  
  // 2. Fazer download
  const response = await fetch(url, { timeout: 30000 });
  if (response.status !== 200) return null;
  
  const content = await response.buffer();
  
  // 3. Calcular hash
  const hash = sha256(content);
  
  // 4. Verificar duplicate
  const existing = await db.query(
    'SELECT id FROM documentos_padronizacao WHERE hash_conteudo = $1',
    [hash]
  );
  if (existing.rows.length > 0) {
    return existing.rows[0].id;  // Já existe, skip
  }
  
  // 5. Salvar documento
  const docId = uuidv4();
  await storage.save(`docs/${docId}.pdf`, content);
  
  // 6. Registrar no banco
  await db.query(
    'INSERT INTO documentos_padronizacao (id, item_id, titulo, url, hash_conteudo) VALUES ($1, $2, $3, $4, $5)',
    [docId, item.id, url.split('/').pop(), url, hash]
  );
  
  return docId;
}
```

## Deduplicação

### Usando Hash de Conteúdo

```typescript
// Hash do conteúdo = SHA256(nome || descricao || codigos)
const hashConteudo = sha256(
  `${item.nome}|${item.descricao}|${item.codigosCatmat.join(',')}`
);

// Upsert com ON CONFLICT
await db.query(
  `INSERT INTO itens_padronizados (slug, nome, hash_conteudo, ...)
   VALUES ($1, $2, $3, ...)
   ON CONFLICT (slug) DO UPDATE SET
     nome = EXCLUDED.nome,
     hash_conteudo = EXCLUDED.hash_conteudo,
     ultima_coleta_em = NOW()
   WHERE itens_padronizados.hash_conteudo != $3`,
  [item.slug, item.nome, hashConteudo]
);
```

## CATMAT/CATSER Mapping

### Estrutura de Códigos

```
CATMAT (Materiais):
├── 11xxxx - Materiais de Consumo
│   ├── 110101 - Papel A4
│   ├── 110102 - Papel Ofício
│   └── ...
├── 12xxxx - Informática
│   ├── 120101 - Computador
│   └── ...
└── ...

CATSER (Serviços):
├── 21xxxx - Serviços Gerais
│   ├── 210101 - Limpeza
│   └── ...
├── 22xxxx - Serviços de TI
│   └── ...
└── ...
```

### Validação de Código

```typescript
function validarCodigoCatmat(codigo: string): boolean {
  // CATMAT começa com '1'
  // Tem 6 dígitos total
  return /^1\d{5}$/.test(codigo);
}

function validarCodigoCatser(codigo: string): boolean {
  // CATSER começa com '2'
  // Tem 6 dígitos total
  return /^2\d{5}$/.test(codigo);
}
```

## Desafios e Soluções

### Problema 1: Página JavaScript-rendered

**Desafio:** Conteúdo pode ser gerado via JavaScript  
**Solução:** Usar Puppeteer para headless browser

```typescript
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://www.gov.br/pncp/pt-br/catalogo', {
  waitUntil: 'networkidle2',
  timeout: 60000,
});
const html = await page.content();
await browser.close();
```

### Problema 2: Mudança de estrutura HTML

**Desafio:** Estrutura HTML pode mudar sem aviso  
**Solução:** Parser robusto com fallbacks

```typescript
// Tentar diferentes seletores
const rows = $('table tbody tr')         // Selector 1
           || $('[role="grid"] .row')     // Selector 2
           || $('.catalogo-item');         // Selector 3
```

### Problema 3: Documentos com URLs dinâmicas

**Desafio:** URLs podem expirar ou mudar  
**Solução:** Download + cache local

```typescript
// Salvar em storage próprio
const docId = uuidv4();
await storage.save(`/docs/${docId}/spec.pdf`, pdfContent);

// Registrar URL original + local
await db.query(
  'INSERT INTO documentos_padronizacao (url_original, url_local, ...)',
  [`https://gov.br/...`, `/docs/${docId}/spec.pdf`, ...]
);
```

## Query Examples

### Buscar item por CATMAT

```sql
SELECT * FROM itens_padronizados
WHERE '110101' = ANY(codigos_catmat)
LIMIT 1;
-- Retorna: Paper A4 75g/m²
```

### Listar todos CATMAT de Materiais

```sql
SELECT DISTINCT codigos_catmat
FROM itens_padronizados
WHERE codigos_catmat[1] LIKE '11%'
ORDER BY codigos_catmat[1];
```

### Documentos de um item

```sql
SELECT * FROM documentos_padronizacao
WHERE item_id = $1
ORDER BY criado_em DESC;
```

## Performance Targets

| Operação | Alvo | Notas |
|----------|------|-------|
| Parser HTML | <10s | Cheerio |
| Download docs | <2 min | Para 200+ PDFs |
| Upsert 5k itens | <10s | Batch insert |
| Hash dedup | <1s | SHA256 |
| Total coleta | <60 min | Inclui downloads |

## Próximos Passos

- [ ] Implementar CatalogoCollector.fetchCatalogoHtml()
- [ ] Implementar parser robusto com fallbacks
- [ ] Testes com dados reais do gov.br
- [ ] Download de documentos de forma confiável
- [ ] Validação de duplicatas por hash

## Referências

- [Portal Gov.br PNCP](https://www.gov.br/pncp/pt-br/catalogo)
- [FASE-1-ARCHITECTURE.md](./FASE-1-ARCHITECTURE.md)
- [CatalogoCollector.ts](../server/workers/CatalogoCollector.ts)
- [Cheerio Documentation](https://cheerio.js.org/)
- [Puppeteer Documentation](https://pptr.dev/)
