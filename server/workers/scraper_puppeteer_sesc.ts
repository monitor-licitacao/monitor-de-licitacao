/**
 * feat(worker): sesc-sp-puppeteer-dynamic
 * Scraper avançado usando Puppeteer para o portal do SESC SP (Mural).
 * Agora é MULTI-TENANT e busca regras (Keywords/NCMs) dinâmicas do banco.
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';
import puppeteer from 'puppeteer';
import { withBrowserPage } from '../lib/browser';
import { eq, inArray } from 'drizzle-orm';
import { SESC_SELECTORS } from '../lib/sescSelectors';

const URL_SESC_SP_MURAL = 'https://scr360.paradigmabs.com.br/sescsp/portal/Mural.aspx';

function parseDateStr(dateStr: string): Date {
  const parts = dateStr.trim().split(' ');
  const [dia, mes, ano] = (parts[0] || '').split('/');
  const [hora, min] = (parts[1] || '00:00').split(':');
  
  if (!dia || !mes || !ano) return new Date();
  return new Date(`${ano}-${mes}-${dia}T${hora}:${min}:00-03:00`);
}

interface TenantRule {
  tenantId: number;
  keywords: string[];
  ncms: string[];
}

async function runSescPuppeteerScraper() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ ERRO: DATABASE_URL não configurada.');
    process.exit(1);
  }

  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  // 1. Carrega todos os tenants e suas respectivas regras
  const tenants = await db.select().from(schema.tenants);
  if (tenants.length === 0) {
    console.error('❌ Nenhum tenant encontrado no banco.');
    process.exit(1);
  }

  // Batch-load NCMs + configs (2 queries total) then group in memory - avoids N+1 / 2T round-trips (#8 E1 / Q3)
  const tenantIds = tenants.map((t) => t.id);

  const [allNcms, allConfigs] = await Promise.all([
    db.select().from(schema.tenantNcms).where(inArray(schema.tenantNcms.tenantId, tenantIds)),
    db.select().from(schema.tenantConfigs).where(inArray(schema.tenantConfigs.tenantId, tenantIds)),
  ]);

  const ncmsByTenant = new Map<number, string[]>();
  for (const n of allNcms) {
    if (!n.active) continue;
    const list = ncmsByTenant.get(n.tenantId) ?? [];
    list.push(n.code.trim().toLowerCase());
    ncmsByTenant.set(n.tenantId, list);
  }

  const keywordsByTenant = new Map<number, string[]>();
  for (const c of allConfigs) {
    if (!c.searchKeywords) continue;
    keywordsByTenant.set(
      c.tenantId,
      c.searchKeywords.map((k: string) => k.toLowerCase().trim()),
    );
  }

  const tenantRules: TenantRule[] = tenants.map((tenant) => ({
    tenantId: tenant.id,
    keywords: keywordsByTenant.get(tenant.id) ?? [],
    ncms: ncmsByTenant.get(tenant.id) ?? [],
  }));

  const sourceId = 'src-sesc-sp-01';

  console.log(`🚀 Iniciando Puppeteer Scraper SESC SP Dinâmico...`);
  console.log(`🏢 Carregadas regras para ${tenantRules.length} tenants ativos.`);
  let newInsertions = 0;

  try {
    await withBrowserPage(async (page) => {
    
    console.log(`  Navegando para ${URL_SESC_SP_MURAL}...`);
    await page.goto(URL_SESC_SP_MURAL, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log(`  Aguardando carregamento da tabela de dados...`);
    await page.waitForSelector(SESC_SELECTORS.row, { timeout: 30000 });

    const rowsData = await page.evaluate((selectors) => {
      const rows = Array.from(document.querySelectorAll(selectors.row));
      return rows.map(tr => {
        const tds = tr.querySelectorAll('td');
        if (tds.length < 6) return null;
        return {
          processNumber: tds[selectors.columns.processNumber]?.textContent?.trim() || '',
          agency: tds[selectors.columns.agency]?.textContent?.trim() || '',
          objectDesc: tds[selectors.columns.objectDesc]?.textContent?.trim() || '',
          modalidade: tds[selectors.columns.modalidade]?.textContent?.trim() || '',
          dateStr: tds[selectors.columns.dateStr]?.textContent?.trim() || '',
        };
      }).filter(r => r !== null);
    }, SESC_SELECTORS);

    console.log(`  Encontrados ${rowsData.length} registros na página usando Puppeteer!`);

    // Accumulate matches then multi-row insert outside the loop (#3 Q4 / #9 E2)
    type EditalInsert = typeof schema.editais.$inferInsert;
    const pendingInserts: EditalInsert[] = [];

    for (const data of rowsData) {
      if (!data) continue;

      const itemDesc = data.objectDesc.toLowerCase();

      for (const rule of tenantRules) {
        // SESC nao mostra o NCM na listagem; match e por Keyword do objeto
        const hasKeywordMatch =
          rule.keywords.length > 0 && rule.keywords.some((kw) => itemDesc.includes(kw));

        if (hasKeywordMatch) {
          const uniqueId = `edital-sescsp-${data.processNumber}-${rule.tenantId}`
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-');
          const bidDate = parseDateStr(data.dateStr);

          pendingInserts.push({
            id: uniqueId,
            tenantId: rule.tenantId, // vincula ao tenant
            sourceId,
            processNumber: data.processNumber,
            title: data.objectDesc.slice(0, 100),
            sourceName: 'SESC SP (Mural)',
            sourceCategory: 'SESC',
            ncmCode: rule.ncms[0] || 'N/A', // Assumir NCM principal do tenant ou N/A
            objectDescription: data.objectDesc,
            url: URL_SESC_SP_MURAL,
            rawUrl: URL_SESC_SP_MURAL,
            status: 'OPEN',
            agency: `SESC SP - ${data.agency}`,
            publishedAt: new Date(),
            biddingDate: bidDate,
            humanReviewStatus: 'PENDING',
          });
        }
      }
    }

    if (pendingInserts.length > 0) {
      try {
        await db.insert(schema.editais).values(pendingInserts).onConflictDoNothing();
        newInsertions = pendingInserts.length;
        for (const row of pendingInserts) {
          console.log(`    ✓ [TENANT ${row.tenantId}] Match KEYWORD: Salvo ${row.id}`);
        }
      } catch (dbErr: any) {
        console.log(`    ⚠️ Erro DB (batch insert): ${dbErr.message}`);
      }
    }

    });
  } catch (error: any) {
    console.error(`❌ Erro no Scraper Puppeteer: ${error.message}`);
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
    // ignorar
  }

  console.log('\n════════════════════════════════════════════════');
  console.log(`🎉 Scraper Puppeteer Dinâmico finalizado! ${newInsertions} novos editais validados.`);
}

import cron from 'node-cron';

const isCron = process.env.WORKER_CRON === 'true';

if (isCron) {
  console.log('⏳ Iniciando orquestração Cron para SESC SP (Executando diariamente às 08:00)...');
  cron.schedule('0 8 * * *', async () => {
    try {
      await runSescPuppeteerScraper();
    } catch (e) {
      console.error('❌ Erro no job cron SESC SP:', e);
    }
  });
  
  runSescPuppeteerScraper().catch(console.error);
} else {
  runSescPuppeteerScraper().then(() => {
    process.exit(0);
  }).catch(e => {
    console.error(e);
    process.exit(1);
  });
}
