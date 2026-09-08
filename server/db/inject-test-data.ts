import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import { encryptSecret } from '../lib/crypto';
import { INITIAL_SOURCES } from '../data';

async function injectRealisticTest() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ ERRO: DATABASE_URL não configurada.');
    process.exit(1);
  }

  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  const tenants = await db.select().from(schema.tenants);
  const tenantId = tenants[0].id;

  // IDs fixos (não randomizados a cada execução) para que onConflictDoUpdate
  // abaixo realmente atualize os registros existentes em vez de duplicá-los
  // a cada `npm run` deste script.
  const PNCP_EDITAL_ID = 'edital-test-pncp-001';

  const editaisTest = [
    {
      id: PNCP_EDITAL_ID,
      tenantId,
      sourceId: 'src-pncp-api-01',
      processNumber: 'PE 1234/2026',
      title: 'Aquisição de Aparelhos de Musculação',
      sourceName: 'PNCP (Portal Nacional)',
      sourceCategory: 'Federal',
      ncmCode: '9506.91',
      objectDescription: 'Pregão Eletrônico para aquisição de equipamentos de academia (esteiras, bicicletas ergométricas e estações de musculação) para atendimento aos projetos sociais do município.',
      url: 'https://pncp.gov.br/app/editais/1234',
      rawUrl: 'https://pncp.gov.br/app/editais/1234',
      status: 'OPEN',
      agency: 'Prefeitura Municipal de Teste',
      estimatedValue: '350000.00',
      s3StorageKey: 's3://editais-vault/pncp/2026/PE-1234-2026.pdf',
      sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      fileSizeBytes: 1258291, // 1.2MB
      publishedAt: new Date(new Date().setDate(new Date().getDate() - 1)), // 1 dia atrás
      biddingDate: new Date(new Date().setDate(new Date().getDate() + 10)), // Daqui a 10 dias
      humanReviewStatus: 'PENDING',
      findings: [
        {
          id: 'finding-pncp-001',
          editalId: PNCP_EDITAL_ID,
          page: 12,
          snippet: "O fornecimento deverá ser exclusivo da marca X ou Y, sob pena de desclassificação.",
          legalBasis: "Art. 41, I, da Lei nº 14.133/2021",
          findingType: "MARCA_ESPECIFICA",
          explanation: "O edital exige marca específica sem a devida justificativa técnica de padronização.",
          confidence: "ALTA",
          status: "ATIVO",
          humanDecision: "PENDING",
          impactRisk: "ALTO"
        }
      ]
    },
    {
      id: 'edital-test-sescsp-001',
      tenantId,
      sourceId: 'src-sesc-sp-01',
      processNumber: 'PE 2026012000450',
      title: 'Renovação do Parque de Ginástica - Unidade Pinheiros',
      sourceName: 'SESC SP (Mural)',
      sourceCategory: 'SESC',
      ncmCode: '9506.91',
      objectDescription: 'Fornecimento e instalação de halteres, anilhas e acessórios esportivos para a unidade SESC Pinheiros.',
      url: 'https://scr360.paradigmabs.com.br/sescsp/portal/Mural.aspx',
      rawUrl: 'https://scr360.paradigmabs.com.br/sescsp/portal/Mural.aspx',
      status: 'OPEN',
      agency: 'SESC SP - ADMINISTRAÇÃO CENTRAL',
      estimatedValue: '120500.00',
      s3StorageKey: 's3://editais-vault/sesc-sp/2026/PE-2026012000450.pdf',
      sha256Hash: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
      fileSizeBytes: 2097152, // 2MB
      publishedAt: new Date(new Date().setDate(new Date().getDate() - 2)),
      biddingDate: new Date(new Date().setDate(new Date().getDate() + 8)),
      humanReviewStatus: 'PENDING',
    },
    {
      id: 'edital-test-sest-001',
      tenantId,
      sourceId: 'src-sest-senat-compras-01',
      processNumber: 'Dispensa 045/2026',
      title: 'Equipamentos de Fisioterapia e Cultura Física',
      sourceName: 'SEST SENAT - Compras',
      sourceCategory: 'Sistema S',
      ncmCode: '9506.91',
      objectDescription: 'Aquisição de aparelhos de ginástica e equipamentos de fisioterapia para recuperação motora de trabalhadores do transporte.',
      url: 'https://compras.sestsenat.org.br/licitacao/123',
      rawUrl: 'https://compras.sestsenat.org.br',
      status: 'OPEN',
      agency: 'SEST SENAT - Conselho Regional',
      estimatedValue: '85000.00',
      s3StorageKey: 's3://editais-vault/sest-senat/CC-045-2026.pdf',
      sha256Hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      fileSizeBytes: 3145728, // 3MB
      publishedAt: new Date(),
      biddingDate: new Date(new Date().setDate(new Date().getDate() + 15)),
      humanReviewStatus: 'PENDING',
    }
  ];

  console.log('💉 Injetando configs do tenant...');
  const tenantConfigData = {
    tenantId,
    searchKeywords: ['academia ao ar livre', 'equipamentos de musculação', 'fisioterapia'],
    ploomesConfig: {
      pipelineId: 100,
      stageId: 1,
      isActive: true
    },
    pncpConfig: {
      certificatePath: 'D:\\CERTIFICADOS 2026-2027\\meucertificado.pfx',
      certificatePassword: encryptSecret('senha_do_certificado'),
      isActive: true
    }
  };

  const existingConfigs = await db.select().from(schema.tenantConfigs).where(eq(schema.tenantConfigs.tenantId, tenantId));
  if (existingConfigs.length > 0) {
    await db.update(schema.tenantConfigs)
      .set({ pncpConfig: tenantConfigData.pncpConfig })
      .where(eq(schema.tenantConfigs.tenantId, tenantId));
    console.log(' ✅ Configs atualizadas.');
  } else {
    await db.insert(schema.tenantConfigs).values(tenantConfigData);
    console.log(' ✅ Configs criadas.');
  }

  console.log('💉 Injetando registros realistas no banco...');
  for (const edital of editaisTest) {
    await db.insert(schema.editais).values(edital).onConflictDoUpdate({
      target: schema.editais.id,
      set: edital
    });
    console.log(` ✅ Inserido/Atualizado: ${edital.title}`);
  }

  console.log('💉 Injetando Conectores (Sources)...');
  for (const source of INITIAL_SOURCES) {
    const sourceData = {
      id: source.id,
      tenantId,
      name: source.name,
      category: source.category,
      type: source.type,
      uf: source.uf,
      city: source.city,
      endpointOrUrl: source.endpointOrUrl,
      selectorOrParams: source.selectorOrParams,
      authType: source.authType,
      status: source.status as any,
      lastCheckedAt: new Date(source.lastCheckedAt),
      latencyMs: source.latencyMs,
      successRate: Math.round(source.successRate),
      totalCollected: source.totalCollected,
      format: source.format,
      notes: source.notes
    };
    await db.insert(schema.sources).values(sourceData).onConflictDoUpdate({
      target: schema.sources.id,
      set: sourceData
    });
  }
  console.log(` ✅ ${INITIAL_SOURCES.length} Conectores Inseridos/Atualizados.`);

  await client.end();
  console.log('✅ Finalizado. Verifique a UI.');
}

injectRealisticTest().catch((e) => {
  console.error(e);
  process.exit(1);
});
