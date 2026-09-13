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

const BASE_URL = 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao';

// As principais modalidades onde ocorrem compras
const MODALIDADES = [
  6, // Pregão Eletrônico
  5, // Concorrência Eletrônica
  4, // Concorrência
  8, // Dispensa Eletrônica
];

function extractPdfUrl(arquivos: any[]): string | null {
  if (!arquivos || !Array.isArray(arquivos)) return null;
  const editalDoc = arquivos.find(a => 
    a.tipoDocumentoNome?.toLowerCase() === 'edital' || 
    a.titulo?.toLowerCase().includes('edital')
  );
  return editalDoc ? editalDoc.url : (arquivos[0]?.url || null);
}

// Representa a regra de negócio carregada do banco
interface TenantRule {
  tenantId: number;
  keywords: string[];
  ncms: string[];
  pncpConfig?: {
    certificatePath?: string;
    certificatePassword?: string;
    isActive?: boolean;
  };
}

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
  
  const formatDate = (date: Date) => date.toISOString().split('T')[0].replace(/-/g, '');

  const dataInicial = formatDate(thirtyDaysAgo);
  const dataFinal = formatDate(today);

  console.log(`🚀 Iniciando Coletor PNCP Dinâmico [${dataInicial} a ${dataFinal}]`);
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

  for (const modalidade of MODALIDADES) {
    console.log(`\n🔍 Buscando modalidade ${modalidade}...`);
    let page = 1;
    let keepSearching = true;

    while (keepSearching && page <= 5) { // Limite de paginação
      const url = new URL(BASE_URL);
      url.searchParams.set('dataInicial', dataInicial);
      url.searchParams.set('dataFinal', dataFinal);
      url.searchParams.set('codigoModalidadeContratacao', String(modalidade));
      url.searchParams.set('tamanhoPagina', '50');
      url.searchParams.set('pagina', String(page));

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

        const data: any = await res.json();
        const items = data?.data || [];
        
        if (items.length === 0) {
          keepSearching = false;
          break;
        }

        console.log(`  [Página ${page}] Lidos ${items.length} registros...`);

        // Para cada item da API, cruza com as regras dos tenants
        for (const item of items) {
          const itemNcm = (item.codigoNcm || '').toLowerCase().trim();
          const itemDesc = (item.objetoCompra || item.objeto || '').toLowerCase();
          
          for (const rule of tenantRules) {
            // Verifica se o edital bate com NCM ou Keyword do tenant
            const hasNcmMatch = rule.ncms.length > 0 && rule.ncms.some(ncm => itemNcm.startsWith(ncm));
            const hasKeywordMatch = rule.keywords.length > 0 && rule.keywords.some(kw => itemDesc.includes(kw));
            
            if (hasNcmMatch || hasKeywordMatch) {
              // Edital de interesse para este tenant!
              const uniqueId = `edital-pncp-${item.anoContratacao}-${item.numeroContratacao}-${item.orgaoEntidade?.cnpj || 's-cnpj'}`
                .toLowerCase().replace(/[^a-z0-9-]/g, '-');

              const pdfUrl = extractPdfUrl(item.arquivos);
              const agencyName = item.orgaoEntidade?.razaoSocial || 'Órgão Desconhecido';
              
              const pubDate = item.dataPublicacaoPncp ? new Date(item.dataPublicacaoPncp) : new Date();
              const bidDate = item.dataAberturaProposta ? new Date(item.dataAberturaProposta) : pubDate;

              try {
                await db.insert(schema.editais).values({
                  id: uniqueId,
                  tenantId: rule.tenantId, // Vincula ao tenant que deu match
                  sourceId,
                  processNumber: item.processo || `${item.numeroContratacao}/${item.anoContratacao}`,
                  title: (item.objetoCompra || item.objeto || '').slice(0, 100),
                  sourceName: 'PNCP (Portal Nacional)',
                  sourceCategory: 'Federal',
                  ncmCode: item.codigoNcm || (rule.ncms[0] || 'N/A'), // Salva o NCM oficial ou o 1º da regra
                  objectDescription: item.objetoCompra || item.objeto || '',
                  url: pdfUrl || item.linkSistemaOrigem, 
                  rawUrl: item.linkSistemaOrigem || url.toString(),
                  status: 'OPEN',
                  agency: agencyName,
                  estimatedValue: item.valorTotalEstimado ? String(item.valorTotalEstimado) : null,
                  publishedAt: pubDate,
                  biddingDate: bidDate,
                  humanReviewStatus: 'PENDING',
                }).onConflictDoNothing();
                
                console.log(`    ✅ [TENANT ${rule.tenantId}] Match [${hasNcmMatch ? 'NCM' : 'KEYWORD'}]: Salvo ${uniqueId}`);
                newInsertions++;
              } catch (dbErr: any) {
                console.log(`    ⚠️ Erro DB: ${dbErr.message}`);
              }
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
