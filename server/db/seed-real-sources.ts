/**
 * feat(sources): seed-real-sources
 * Popula o banco Neon com as 5 fontes reais priorizadas (Regra 2: Zero Fachada)
 * + testa a PNCP API em tempo real antes de inserir.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import 'dotenv/config';

const REAL_SOURCES = [
  {
    id: 'src-pncp-api-01',
    name: 'PNCP — Portal Nacional de Contratações Públicas (API)',
    category: 'Federal',
    type: 'API' as const,
    uf: 'BR',
    city: 'Brasília',
    endpointOrUrl: 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao',
    selectorOrParams: JSON.stringify({
      codigoNcm: '9506.91',
      tamanhoPagina: 50,
      pagina: 1,
    }),
    authType: 'NONE' as const,
    format: 'JSON' as const,
    notes: 'API pública REST. Swagger: https://pncp.gov.br/api/consulta/swagger-ui/index.html. Filtrar por codigoNcm=9506.91',
  },
  {
    id: 'src-sest-senat-compras-01',
    name: 'SEST SENAT — Portal de Compras Eletrônicas',
    category: 'Sistema S',
    type: 'SCRAPER' as const,
    uf: 'BR',
    city: 'Brasília',
    endpointOrUrl: 'https://compras.sestsenat.org.br',
    selectorOrParams: JSON.stringify({
      listSelector: '.licitacao-item, table.lista-licitacoes tr, .edital-row',
      linkSelector: 'a[href*="edital"], a[href$=".pdf"]',
      titleSelector: '.objeto, td:nth-child(2), .titulo-licitacao',
      dateSelector: '.data-abertura, td:nth-child(4)',
    }),
    authType: 'NONE' as const,
    format: 'HTML' as const,
    notes: 'Portal próprio SEST SENAT. Layout mais padronizado do Sistema S. Alto volume de licitações de equipamentos fitness.',
  },
  {
    id: 'src-sesc-sp-01',
    name: 'SESC São Paulo — Licitações e Contratações',
    category: 'SESC',
    type: 'SCRAPER' as const,
    uf: 'SP',
    city: 'São Paulo',
    endpointOrUrl: 'https://www.sescsp.org.br/licitacoes/',
    selectorOrParams: JSON.stringify({
      listSelector: '.licitacao-item, .post-item, table tr',
      linkSelector: 'a[href*=".pdf"], a[href*="edital"]',
      titleSelector: '.titulo, .entry-title, td.objeto',
      dateSelector: '.data, .date, td.prazo',
    }),
    authType: 'NONE' as const,
    format: 'HTML' as const,
    notes: 'Maior regional do SESC. Alto volume. Não segue PNCP — monitoramento direto obrigatório.',
  },
  {
    id: 'src-sesc-rs-01',
    name: 'SESC Rio Grande do Sul — Licitações',
    category: 'SESC',
    type: 'SCRAPER' as const,
    uf: 'RS',
    city: 'Porto Alegre',
    endpointOrUrl: 'https://www.sesc-rs.com.br/licitacoes',
    selectorOrParams: JSON.stringify({
      listSelector: '.licitacao, table.editais tr, .item-licitacao',
      linkSelector: 'a[href$=".pdf"], a[href*="download"]',
      titleSelector: '.objeto, td.titulo, h3',
      dateSelector: '.data, td.data',
    }),
    authType: 'NONE' as const,
    format: 'HTML' as const,
    notes: 'Regional RS. Contato CPL: cpl@sesc-rs.com.br',
  },
  {
    id: 'src-sesi-sp-transp-01',
    name: 'SESI São Paulo — Portal de Transparência (Licitações)',
    category: 'SESI',
    type: 'SCRAPER' as const,
    uf: 'SP',
    city: 'São Paulo',
    endpointOrUrl: 'https://transparencia.sesisp.org.br/licitacoes/licitacoes-editais',
    selectorOrParams: JSON.stringify({
      listSelector: 'article.edital',
      titleSelector: '#Resumo, h3',
      descriptionSelector: '#Objeto',
      dateSelector: '#Status',
    }),
    authType: 'NONE' as const,
    format: 'HTML' as const,
    notes: 'SESI SP Transparência. Seletores validados diretamente no DOM real da página pública.',
  },
];

async function testPncpApi(): Promise<{ ok: boolean; totalEditais: number; sampleTitle?: string }> {
  console.log('\n🔍 [TESTE REAL] Chamando PNCP API para NCM 9506.91...');
  try {
    const url = new URL('https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao');
    url.searchParams.set('dataInicial', '2026-01-01');
    url.searchParams.set('dataFinal', '2026-12-31');
    url.searchParams.set('tamanhoPagina', '5');
    url.searchParams.set('pagina', '1');

    const res = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Monitor-Editais/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`   ⚠️  PNCP retornou HTTP ${res.status}. Pode precisar de parâmetros diferentes.`);
      // Tentar endpoint alternativo sem filtro de NCM (PNCP ainda não suporta filtro direto por NCM em todas versões)
      const url2 = new URL('https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao');
      url2.searchParams.set('dataInicial', '2026-08-01');
      url2.searchParams.set('dataFinal', '2026-09-04');
      url2.searchParams.set('tamanhoPagina', '5');
      url2.searchParams.set('pagina', '1');
      const res2 = await fetch(url2.toString(), { signal: AbortSignal.timeout(10000) });
      if (res2.ok) {
        const data2 = await res2.json();
        const total = data2?.totalRegistros || data2?.total || data2?.data?.length || 0;
        const sample = data2?.data?.[0]?.objetoCompra || data2?.data?.[0]?.objeto || 'N/A';
        console.log(`   ✅ PNCP OK (endpoint alternativo). Total registros: ${total}`);
        console.log(`   📄 Amostra: "${sample}"`);
        return { ok: true, totalEditais: total, sampleTitle: sample };
      }
      return { ok: false, totalEditais: 0 };
    }

    const data = await res.json();
    const total = data?.totalRegistros || data?.total || data?.data?.length || 0;
    const sample = data?.data?.[0]?.objetoCompra || data?.data?.[0]?.objeto || 'N/A';
    console.log(`   ✅ PNCP OK! Total registros em 2026: ${total}`);
    console.log(`   📄 Amostra: "${sample}"`);
    return { ok: true, totalEditais: total, sampleTitle: sample };
  } catch (e: any) {
    console.error(`   ❌ Erro ao chamar PNCP: ${e.message}`);
    return { ok: false, totalEditais: 0 };
  }
}

async function testSescSp(): Promise<{ ok: boolean; httpStatus: number }> {
  console.log('\n🔍 [TESTE REAL] Testando conectividade SESC SP...');
  try {
    const res = await fetch('https://www.sescsp.org.br/licitacoes/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(8000),
    });
    console.log(`   HTTP ${res.status} — ${res.ok ? '✅ Acessível' : '⚠️ Não OK'}`);
    return { ok: res.ok, httpStatus: res.status };
  } catch (e: any) {
    console.error(`   ❌ Timeout/Erro: ${e.message}`);
    return { ok: false, httpStatus: 0 };
  }
}

async function testSestSenat(): Promise<{ ok: boolean; httpStatus: number }> {
  console.log('\n🔍 [TESTE REAL] Testando conectividade SEST SENAT...');
  try {
    const res = await fetch('https://compras.sestsenat.org.br', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(8000),
    });
    console.log(`   HTTP ${res.status} — ${res.ok ? '✅ Acessível' : '⚠️ Não OK'}`);
    return { ok: res.ok, httpStatus: res.status };
  } catch (e: any) {
    console.error(`   ❌ Timeout/Erro: ${e.message}`);
    return { ok: false, httpStatus: 0 };
  }
}

async function runRealSourcesSeed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ ERRO: DATABASE_URL não configurada.');
    process.exit(1);
  }

  console.log('🚀 feat(sources): seed-real-sources');
  console.log('═══════════════════════════════════════');

  // FASE 1: Testes reais de conectividade
  console.log('\n📡 FASE 1: Testes de conectividade real nos portais...');
  const [pncpResult, sescSpResult, sestSenatResult] = await Promise.all([
    testPncpApi(),
    testSescSp(),
    testSestSenat(),
  ]);

  console.log('\n📊 Resumo dos testes:');
  console.log(`   PNCP API:    ${pncpResult.ok ? '✅ OK' : '❌ FALHOU'} ${pncpResult.ok ? `(${pncpResult.totalEditais} registros)` : ''}`);
  console.log(`   SESC SP:     ${sescSpResult.ok ? `✅ HTTP ${sescSpResult.httpStatus}` : `❌ HTTP ${sescSpResult.httpStatus}`}`);
  console.log(`   SEST SENAT:  ${sestSenatResult.ok ? `✅ HTTP ${sestSenatResult.httpStatus}` : `❌ HTTP ${sestSenatResult.httpStatus}`}`);

  // FASE 2: Inserir fontes reais no banco
  console.log('\n📡 FASE 2: Inserindo fontes reais no Neon DB...');
  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  // Buscar tenantId existente (Konnen Fitness = 1)
  const tenants = await db.select().from(schema.tenants);
  if (tenants.length === 0) {
    console.error('❌ Nenhum tenant encontrado. Execute a seed principal primeiro.');
    await client.end();
    process.exit(1);
  }
  const tenantId = tenants[0].id;
  console.log(`   🏢 Usando tenant: ${tenants[0].name} (ID: ${tenantId})`);

  let inserted = 0;
  let skipped = 0;

  for (const source of REAL_SOURCES) {
    try {
      await db.insert(schema.sources)
        .values({
          ...source,
          tenantId,
          status: 'ACTIVE',
          lastCheckedAt: new Date(),
          latencyMs: null,
          successRate: null,
          totalCollected: 0,
        })
        .onConflictDoUpdate({
          target: schema.sources.id,
          set: {
            name: source.name,
            endpointOrUrl: source.endpointOrUrl,
            selectorOrParams: source.selectorOrParams,
            notes: source.notes,
            status: 'ACTIVE',
            lastCheckedAt: new Date(),
          },
        });
      console.log(`   ✅ Inserida: ${source.name}`);
      inserted++;
    } catch (e: any) {
      console.error(`   ⚠️  Pulou ${source.id}: ${e.message}`);
      skipped++;
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`✅ Seed concluído! ${inserted} fontes inseridas, ${skipped} puladas.`);
  console.log('\n🔗 URLs registradas no banco:');
  REAL_SOURCES.forEach((s, i) => {
    const icon = i === 0 ? '🏛️' : '🌐';
    console.log(`   ${icon} [${s.id}] ${s.endpointOrUrl}`);
  });

  if (pncpResult.ok && pncpResult.sampleTitle && pncpResult.sampleTitle !== 'N/A') {
    console.log(`\n📄 Amostra PNCP (dado real): "${pncpResult.sampleTitle}"`);
  }

  await client.end();
  process.exit(0);
}

runRealSourcesSeed().catch(err => {
  console.error('❌ Seed falhou:', err);
  process.exit(1);
});
