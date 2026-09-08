import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import 'dotenv/config';

// Definição dos dados da Konnen Fitness
const KONNEN_FITNESS = {
  name: 'Konnen Fitness',
  domain: 'konnenfitness.com.br',
  primaryColor: '#e30b0b', // Baseado na identidade visual (Vermelho)
  logoUrl: 'https://www.konnenfitness.com.br/wp-content/uploads/2021/08/logo-konnen-fitness-1.png',
};

const KONNEN_KEYWORDS = [
  'equipamentos de musculação',
  'aparelhos fitness',
  'anilhas',
  'halteres',
  'esteiras',
  'bicicletas ergométricas',
  'academia'
];

const PLOOMES_CONFIG = {
  pipelineId: 0,
  stageId: 0,
  fieldIdResumoIa: 'resumo_ia',
  fieldIdLinkEdital: 'link_edital',
  isActive: true,
};

const KONNEN_NCMS = [
  { code: '9506.91.00', description: 'Artigos e equipamentos para cultura física, ginástica ou atletismo' },
  { code: '9506.99.00', description: 'Outros (equipamentos de esporte)' },
];

async function runSeed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ ERRO: DATABASE_URL não está configurada no .env');
    process.exit(1);
  }

  console.log('🚀 Iniciando Seed do Banco de Dados SaaS...');
  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  try {
    // 1. Criar o Tenant (Konnen Fitness)
    console.log('🏢 Criando Tenant: Konnen Fitness...');
    const [tenant] = await db.insert(schema.tenants).values(KONNEN_FITNESS).returning();
    const tenantId = tenant.id;
    console.log(`✅ Tenant criado com ID: ${tenantId}`);

    // 2. Inserir Configurações (Keywords & Ploomes)
    console.log('⚙️ Inserindo configurações e palavras-chave...');
    await db.insert(schema.tenantConfigs).values({
      tenantId,
      searchKeywords: KONNEN_KEYWORDS,
      ploomesConfig: PLOOMES_CONFIG,
    });

    // 3. Inserir NCMs (Metadatados)
    console.log('📦 Inserindo NCMs (Metadados de filtro)...');
    for (const ncm of KONNEN_NCMS) {
      await db.insert(schema.tenantNcms).values({
        tenantId,
        code: ncm.code,
        description: ncm.description,
      });
    }

    // 4. Inserir uma Fonte (Portal de ComprasNet) para este tenant
    console.log('🌐 Configurando fontes iniciais...');
    await db.insert(schema.sources).values({
      id: `src-comprasnet-${Date.now()}`,
      tenantId,
      name: 'Portal de Compras do Governo Federal (ComprasNet)',
      endpointOrUrl: 'https://pncp.gov.br/api/v1',
      type: 'API',
      status: 'ACTIVE',
      category: 'Federal',
      format: 'JSON'
    });

    console.log('🎉 Seed concluído com sucesso!');
  } catch (error) {
    console.error('❌ Erro durante o seed:', error);
  } finally {
    await client.end();
    process.exit(0);
  }
}

runSeed();
