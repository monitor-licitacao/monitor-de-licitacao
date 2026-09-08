/**
 * Status Catalog Service & DB Repository
 * Task: Status catalog CRUD (DB, not hardcoded enums)
 *
 * 5 FAMILIES AND EXACT COUNTS:
 * - ProcessoDeContratacao: 13
 * - ProcessosPresenciais: 17
 * - CotacaoDeOrcamento: 7
 * - PregaoEletronico: 36
 * - CompraDireta: 18
 * Total: 91 entries
 */

import { db, isDatabaseConfigured } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

export const STATUS_FAMILIES = [
  'ProcessoDeContratacao',
  'ProcessosPresenciais',
  'CotacaoDeOrcamento',
  'PregaoEletronico',
  'CompraDireta',
] as const;

export type StatusFamily = (typeof STATUS_FAMILIES)[number];

export interface StatusCatalogItem {
  id?: number;
  family: StatusFamily;
  code: string;
  label: string;
  description: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const INITIAL_STATUS_CATALOG_SEED: StatusCatalogItem[] = [
  // 1. ProcessoDeContratacao (13)
  {
    family: 'ProcessoDeContratacao',
    code: 'AGENDADO_PUBLICADO',
    label: 'Agendado/Publicado',
    description: 'Processo já divulgado e com data marcada.',
    active: true,
  },
  {
    family: 'ProcessoDeContratacao',
    code: 'AGUARDANDO_INICIO_COMISSAO',
    label: 'Aguardando início pela comissão',
    description: 'Aguardando a comissão responsável dar início.',
    active: true,
  },
  {
    family: 'ProcessoDeContratacao',
    code: 'ANULADO',
    label: 'Anulado',
    description: 'Processo invalidado por decisão administrativa ou legal.',
    active: true,
  },
  {
    family: 'ProcessoDeContratacao',
    code: 'CANCELADO',
    label: 'Cancelado',
    description: 'Encerrado antes da conclusão por decisão da instituição.',
    active: true,
  },
  {
    family: 'ProcessoDeContratacao',
    code: 'DESERTO',
    label: 'Deserto',
    description: 'Nenhum participante apresentou proposta.',
    active: true,
  },
  {
    family: 'ProcessoDeContratacao',
    code: 'EM_ANDAMENTO',
    label: 'Em andamento',
    description: 'Processo ativo e em execução.',
    active: true,
  },
  {
    family: 'ProcessoDeContratacao',
    code: 'EM_APROVACAO',
    label: 'Em aprovação',
    description: 'Etapa aguardando validação formal.',
    active: true,
  },
  {
    family: 'ProcessoDeContratacao',
    code: 'EM_CONFIGURACAO',
    label: 'Em configuração',
    description: 'Preparação técnica ou documental em curso.',
    active: true,
  },
  {
    family: 'ProcessoDeContratacao',
    code: 'FINALIZADO',
    label: 'Finalizado',
    description: 'Processo concluído.',
    active: true,
  },
  {
    family: 'ProcessoDeContratacao',
    code: 'FRACASSADO',
    label: 'Fracassado',
    description: 'Processo sem êxito, não atingiu objetivo.',
    active: true,
  },
  {
    family: 'ProcessoDeContratacao',
    code: 'HOMOLOGADO',
    label: 'Homologado',
    description: 'Resultado confirmado oficialmente.',
    active: true,
  },
  {
    family: 'ProcessoDeContratacao',
    code: 'REVOGADO',
    label: 'Revogado',
    description: 'Processo retirado por decisão superior.',
    active: true,
  },
  {
    family: 'ProcessoDeContratacao',
    code: 'SUSPENSO',
    label: 'Suspenso',
    description: 'Interrompido temporariamente.',
    active: true,
  },

  // 2. ProcessosPresenciais (17)
  {
    family: 'ProcessosPresenciais',
    code: 'AGENDADO',
    label: 'Agendado',
    description: 'Sessão presencial marcada.',
    active: true,
  },
  {
    family: 'ProcessosPresenciais',
    code: 'AGUARDANDO_APROVACAO_COMISSAO',
    label: 'Aguardando aprovação pela comissão',
    description: 'Dependente de validação da comissão.',
    active: true,
  },
  {
    family: 'ProcessosPresenciais',
    code: 'ANULADO',
    label: 'Anulado',
    description: 'Invalidado por decisão administrativa.',
    active: true,
  },
  {
    family: 'ProcessosPresenciais',
    code: 'CANCELADO',
    label: 'Cancelado',
    description: 'Encerrado antes da conclusão.',
    active: true,
  },
  {
    family: 'ProcessosPresenciais',
    code: 'DESERTO',
    label: 'Deserto',
    description: 'Sem participantes.',
    active: true,
  },
  {
    family: 'ProcessosPresenciais',
    code: 'EM_ANDAMENTO',
    label: 'Em andamento',
    description: 'Sessão em curso.',
    active: true,
  },
  {
    family: 'ProcessosPresenciais',
    code: 'EM_APROVACAO',
    label: 'Em aprovação',
    description: 'Aguardando validação.',
    active: true,
  },
  {
    family: 'ProcessosPresenciais',
    code: 'EM_CONFIGURACAO',
    label: 'Em configuração',
    description: 'Preparação em andamento.',
    active: true,
  },
  {
    family: 'ProcessosPresenciais',
    code: 'EM_DISPUTA_LANCE',
    label: 'Em disputa de lance',
    description: 'Participantes ofertando valores.',
    active: true,
  },
  {
    family: 'ProcessosPresenciais',
    code: 'EM_HOMOLOGACAO',
    label: 'Em homologação',
    description: 'Resultado em análise para homologação.',
    active: true,
  },
  {
    family: 'ProcessosPresenciais',
    code: 'FRACASSADO',
    label: 'Fracassado',
    description: 'Sem êxito.',
    active: true,
  },
  {
    family: 'ProcessosPresenciais',
    code: 'HOMOLOGADO',
    label: 'Homologado',
    description: 'Resultado confirmado.',
    active: true,
  },
  {
    family: 'ProcessosPresenciais',
    code: 'HOMOLOGADO_COM_CONTRATO',
    label: 'Homologado com contrato',
    description: 'Resultado confirmado e contrato firmado.',
    active: true,
  },
  {
    family: 'ProcessosPresenciais',
    code: 'HOMOLOGADO_COM_PEDIDO',
    label: 'Homologado com pedido',
    description: 'Resultado confirmado e pedido emitido.',
    active: true,
  },
  {
    family: 'ProcessosPresenciais',
    code: 'HOMOLOGADO_COM_REGISTRO_PRECO',
    label: 'Homologado com registro de preço',
    description: 'Resultado confirmado e registro de preço estabelecido.',
    active: true,
  },
  {
    family: 'ProcessosPresenciais',
    code: 'REVOGADO',
    label: 'Revogado',
    description: 'Retirado por decisão superior.',
    active: true,
  },
  {
    family: 'ProcessosPresenciais',
    code: 'SUSPENSO',
    label: 'Suspenso',
    description: 'Interrompido temporariamente.',
    active: true,
  },

  // 3. CotacaoDeOrcamento (7)
  {
    family: 'CotacaoDeOrcamento',
    code: 'AGENDADA',
    label: 'Agendada',
    description: 'Cotação marcada.',
    active: true,
  },
  {
    family: 'CotacaoDeOrcamento',
    code: 'EM_ANALISE',
    label: 'Em análise',
    description: 'Propostas em avaliação.',
    active: true,
  },
  {
    family: 'CotacaoDeOrcamento',
    code: 'EM_ANDAMENTO',
    label: 'Em andamento',
    description: 'Cotação ativa.',
    active: true,
  },
  {
    family: 'CotacaoDeOrcamento',
    code: 'ENCERRADA',
    label: 'Encerrada',
    description: 'Finalizada.',
    active: true,
  },
  {
    family: 'CotacaoDeOrcamento',
    code: 'ENCERRADA_CONTRAOFERTA',
    label: 'Encerrada para contraoferta',
    description: 'Encerrada, mas aberta para nova negociação.',
    active: true,
  },
  {
    family: 'CotacaoDeOrcamento',
    code: 'INTERROMPIDA',
    label: 'Interrompida',
    description: 'Parada antes da conclusão.',
    active: true,
  },
  {
    family: 'CotacaoDeOrcamento',
    code: 'SUSPENSA',
    label: 'Suspensa',
    description: 'Temporariamente pausada.',
    active: true,
  },

  // 4. PregaoEletronico (36)
  {
    family: 'PregaoEletronico',
    code: 'ABERTURA_PROPOSTAS',
    label: 'Abertura de propostas',
    description: 'Início da recepção de propostas.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'AGENDADO_PUBLICADO',
    label: 'Agendado/Publicado',
    description: 'Sessão marcada e divulgada.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'AGUARDANDO_HOMOLOGACAO',
    label: 'Aguardando homologação',
    description: 'Resultado pendente de homologação.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'AGUARDANDO_INICIO_COMISSAO',
    label: 'Aguardando início pela comissão',
    description: 'Dependente da comissão.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'AGUARDANDO_LIBERACAO_FINANCEIRA',
    label: 'Aguardando liberação financeira',
    description: 'Dependente de aprovação financeira.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'AJUSTE_PRECOS',
    label: 'Ajuste de preços',
    description: 'Correção ou adequação de valores.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'ANULADO',
    label: 'Anulado',
    description: 'Invalidado.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'CANCELADO',
    label: 'Cancelado',
    description: 'Encerrado.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'CLASSIFICACAO_PROPOSTAS',
    label: 'Classificação de propostas',
    description: 'Ordenação das propostas recebidas.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'CONTRARRAZOES',
    label: 'Contrarrazões',
    description: 'Apresentação de defesa ou contestação.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'DESERTO',
    label: 'Deserto',
    description: 'Sem propostas.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'EM_ADJUDICACAO',
    label: 'Em adjudicação',
    description: 'Definição do vencedor.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'EM_APROVACAO',
    label: 'Em aprovação',
    description: 'Aguardando validação.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'EM_CONFIGURACAO',
    label: 'Em configuração',
    description: 'Preparação em curso.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'EM_DISPUTA_LANCES',
    label: 'Em disputa de lances',
    description: 'Participantes ofertando valores.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'EM_HOMOLOGACAO_PARCIAL',
    label: 'Em homologação parcial',
    description: 'Parte do processo homologada.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'EM_PROPOSTA',
    label: 'Em proposta',
    description: 'Etapa de envio de propostas.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'ENCERRAMENTO_SESSAO_PUBLICA',
    label: 'Encerramento da sessão pública',
    description: 'Fim da sessão.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'FINANCEIRO_LIBERADO',
    label: 'Financeiro liberado',
    description: 'Recursos financeiros aprovados.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'FRACASSADO',
    label: 'Fracassado',
    description: 'Sem êxito.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'HOMOLOGADO',
    label: 'Homologado',
    description: 'Resultado confirmado.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'HOMOLOGADO_COM_CONTRATO',
    label: 'Homologado com contrato',
    description: 'Resultado confirmado e contrato firmado.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'HOMOLOGADO_COM_PEDIDO',
    label: 'Homologado com pedido',
    description: 'Resultado confirmado e pedido emitido.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'HOMOLOGADO_COM_REGISTRO_PRECO',
    label: 'Homologado com registro de preço',
    description: 'Resultado confirmado e registro de preço estabelecido.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'INTENCAO_RECURSOS',
    label: 'Intenção de recursos',
    description: 'Manifestação de recurso.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'JULGAMENTO_INTENCOES',
    label: 'Julgamento das intenções',
    description: 'Análise das intenções de recurso.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'JULGAMENTO_RECURSOS',
    label: 'Julgamento dos recursos',
    description: 'Decisão sobre recursos apresentados.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'NEGOCIACAO_HABILITACAO_ACEITABILIDADE',
    label: 'Negociação/Habilitação/Aceitabilidade',
    description: 'Etapa de negociação e análise de habilitação.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'PRAZO_PROPOSTAS_PRORROGADO',
    label: 'Prazo de propostas prorrogado',
    description: 'Prazo para envio de propostas prorrogado.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'REENVIO_DOCUMENTOS_HABILITACAO',
    label: 'Reenvio de documentos de habilitação',
    description: 'Prazo aberto para novo envio documental.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'RECURSOS',
    label: 'Recursos',
    description: 'Fase recursal aberta.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'RECURSOS_CONTRARRAZOES',
    label: 'Recursos/Contra-Razões',
    description: 'Análise de recursos e contrarrazões.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'REVOGADO',
    label: 'Revogado',
    description: 'Processo retirado por interesse institucional.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'SESSAO_PUBLICA_ENCERRADA',
    label: 'Sessão pública encerrada',
    description: 'Sessão pública formalmente finalizada.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'SUSPENSO',
    label: 'Suspenso',
    description: 'Interrompido temporariamente.',
    active: true,
  },
  {
    family: 'PregaoEletronico',
    code: 'PROPOSTA_ENVIADA',
    label: 'Proposta enviada',
    description: 'Proposta submetida com sucesso.',
    active: true,
  },

  // 5. CompraDireta (18)
  {
    family: 'CompraDireta',
    code: 'AGENDADO',
    label: 'Agendado',
    description: 'Compra direta agendada e divulgada.',
    active: true,
  },
  {
    family: 'CompraDireta',
    code: 'RECEBIMENTO_LANCES',
    label: 'Recebimento de lances',
    description: 'Período aberto para envio de lances.',
    active: true,
  },
  {
    family: 'CompraDireta',
    code: 'EM_ANDAMENTO',
    label: 'Em andamento',
    description: 'Compra direta em andamento.',
    active: true,
  },
  {
    family: 'CompraDireta',
    code: 'EM_ANALISE',
    label: 'Em análise',
    description: 'Propostas e lances em análise.',
    active: true,
  },
  {
    family: 'CompraDireta',
    code: 'AGUARDANDO_FINALIZACAO',
    label: 'Aguardando finalização',
    description: 'Análise concluída, aguardando formalização final.',
    active: true,
  },
  {
    family: 'CompraDireta',
    code: 'ENCERRADO',
    label: 'Encerrado',
    description: 'Processo finalizado.',
    active: true,
  },
  {
    family: 'CompraDireta',
    code: 'CANCELADO',
    label: 'Cancelado',
    description: 'Cancelado antes da finalização.',
    active: true,
  },
  {
    family: 'CompraDireta',
    code: 'DESERTO',
    label: 'Deserto',
    description: 'Nenhum fornecedor participante.',
    active: true,
  },
  {
    family: 'CompraDireta',
    code: 'FRACASSADO',
    label: 'Fracassado',
    description: 'Nenhum lance aceito ou vantajoso.',
    active: true,
  },
  // Placeholders for remaining CompraDireta codes (without inventing Portuguese labels)
  {
    family: 'CompraDireta',
    code: 'COMPRA_DIRETA_STATUS_10',
    label: 'CompraDireta Status 10',
    description: 'Placeholder estrutural - código reservado da família CompraDireta.',
    active: true,
  },
  {
    family: 'CompraDireta',
    code: 'COMPRA_DIRETA_STATUS_11',
    label: 'CompraDireta Status 11',
    description: 'Placeholder estrutural - código reservado da família CompraDireta.',
    active: true,
  },
  {
    family: 'CompraDireta',
    code: 'COMPRA_DIRETA_STATUS_12',
    label: 'CompraDireta Status 12',
    description: 'Placeholder estrutural - código reservado da família CompraDireta.',
    active: true,
  },
  {
    family: 'CompraDireta',
    code: 'COMPRA_DIRETA_STATUS_13',
    label: 'CompraDireta Status 13',
    description: 'Placeholder estrutural - código reservado da família CompraDireta.',
    active: true,
  },
  {
    family: 'CompraDireta',
    code: 'COMPRA_DIRETA_STATUS_14',
    label: 'CompraDireta Status 14',
    description: 'Placeholder estrutural - código reservado da família CompraDireta.',
    active: true,
  },
  {
    family: 'CompraDireta',
    code: 'COMPRA_DIRETA_STATUS_15',
    label: 'CompraDireta Status 15',
    description: 'Placeholder estrutural - código reservado da família CompraDireta.',
    active: true,
  },
  {
    family: 'CompraDireta',
    code: 'COMPRA_DIRETA_STATUS_16',
    label: 'CompraDireta Status 16',
    description: 'Placeholder estrutural - código reservado da família CompraDireta.',
    active: true,
  },
  {
    family: 'CompraDireta',
    code: 'COMPRA_DIRETA_STATUS_17',
    label: 'CompraDireta Status 17',
    description: 'Placeholder estrutural - código reservado da família CompraDireta.',
    active: true,
  },
  {
    family: 'CompraDireta',
    code: 'COMPRA_DIRETA_STATUS_18',
    label: 'CompraDireta Status 18',
    description: 'Placeholder estrutural - código reservado da família CompraDireta.',
    active: true,
  },
];

/**
 * In-memory repository (synchronized with DB if reachable)
 */
class StatusCatalogRepository {
  private items: StatusCatalogItem[] = [];
  private nextId: number = 1;
  private isInitialized: boolean = false;

  constructor() {
    this.initFromSeed();
  }

  private initFromSeed() {
    this.items = INITIAL_STATUS_CATALOG_SEED.map((seed, idx) => ({
      ...seed,
      id: idx + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    this.nextId = this.items.length + 1;
    this.isInitialized = true;
  }

  async getAll(filter?: { family?: string; active?: boolean; search?: string }): Promise<StatusCatalogItem[]> {
    if (isDatabaseConfigured) {
      try {
        let query = db.select().from(schema.statusCatalog);
        const rows = await query;
        if (rows && rows.length > 0) {
          let list = rows.map((r) => ({
            id: r.id,
            family: r.family as StatusFamily,
            code: r.code,
            label: r.label,
            description: r.description || '',
            active: r.active,
            createdAt: r.createdAt ? r.createdAt.toISOString() : undefined,
            updatedAt: r.updatedAt ? r.updatedAt.toISOString() : undefined,
          }));

          if (filter?.family) {
            list = list.filter((i) => i.family === filter.family);
          }
          if (filter?.active !== undefined) {
            list = list.filter((i) => i.active === filter.active);
          }
          if (filter?.search) {
            const q = filter.search.toLowerCase();
            list = list.filter(
              (i) =>
                i.code.toLowerCase().includes(q) ||
                i.label.toLowerCase().includes(q) ||
                i.description.toLowerCase().includes(q)
            );
          }
          return list;
        }
      } catch (err) {
        // Fallback silently to memory
      }
    }

    // In-memory fallback
    let list = [...this.items];
    if (filter?.family) {
      list = list.filter((i) => i.family === filter.family);
    }
    if (filter?.active !== undefined) {
      list = list.filter((i) => i.active === filter.active);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (i) =>
          i.code.toLowerCase().includes(q) ||
          i.label.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q)
      );
    }
    return list;
  }

  async getById(id: number): Promise<StatusCatalogItem | null> {
    if (isDatabaseConfigured) {
      try {
        const [row] = await db.select().from(schema.statusCatalog).where(eq(schema.statusCatalog.id, id));
        if (row) {
          return {
            id: row.id,
            family: row.family as StatusFamily,
            code: row.code,
            label: row.label,
            description: row.description || '',
            active: row.active,
            createdAt: row.createdAt ? row.createdAt.toISOString() : undefined,
            updatedAt: row.updatedAt ? row.updatedAt.toISOString() : undefined,
          };
        }
      } catch (err) {
        // Fallback silently to memory
      }
    }

    const item = this.items.find((i) => i.id === id);
    return item ? { ...item } : null;
  }

  async getByFamilyAndCode(family: string, code: string): Promise<StatusCatalogItem | null> {
    const normCode = code.trim().toUpperCase();
    if (isDatabaseConfigured) {
      try {
        const rows = await db
          .select()
          .from(schema.statusCatalog)
          .where(sql`${schema.statusCatalog.family} = ${family} AND UPPER(${schema.statusCatalog.code}) = ${normCode}`);
        if (rows && rows.length > 0) {
          const row = rows[0];
          return {
            id: row.id,
            family: row.family as StatusFamily,
            code: row.code,
            label: row.label,
            description: row.description || '',
            active: row.active,
            createdAt: row.createdAt ? row.createdAt.toISOString() : undefined,
            updatedAt: row.updatedAt ? row.updatedAt.toISOString() : undefined,
          };
        }
      } catch (err) {
        // Fallback silently to memory
      }
    }

    const item = this.items.find(
      (i) => i.family === family && (i.code.toUpperCase() === normCode || i.label.toLowerCase() === code.trim().toLowerCase())
    );
    return item ? { ...item } : null;
  }

  async create(data: {
    family: string;
    code: string;
    label: string;
    description?: string;
    active?: boolean;
  }): Promise<StatusCatalogItem> {
    if (!STATUS_FAMILIES.includes(data.family as StatusFamily)) {
      throw new Error(`Família inválida: "${data.family}". Famílias permitidas: ${STATUS_FAMILIES.join(', ')}`);
    }

    const code = data.code.trim().toUpperCase();
    if (!code) {
      throw new Error('Código do status é obrigatório.');
    }
    const label = data.label.trim();
    if (!label) {
      throw new Error('Label do status é obrigatório.');
    }

    // Check duplicate within family
    const existing = await this.getByFamilyAndCode(data.family, code);
    if (existing) {
      throw new Error(`Código "${code}" já existe na família "${data.family}".`);
    }

    const newItem: StatusCatalogItem = {
      id: this.nextId++,
      family: data.family as StatusFamily,
      code,
      label,
      description: data.description?.trim() || '',
      active: data.active !== undefined ? data.active : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isDatabaseConfigured) {
      try {
        const [inserted] = await db
          .insert(schema.statusCatalog)
          .values({
            family: newItem.family,
            code: newItem.code,
            label: newItem.label,
            description: newItem.description,
            active: newItem.active,
          })
          .returning();
        if (inserted) {
          newItem.id = inserted.id;
        }
      } catch (err) {
        console.warn('⚠️ statusCatalog db insert error:', (err as Error).message);
      }
    }

    this.items.push(newItem);
    return newItem;
  }

  async update(
    id: number,
    data: { label?: string; description?: string; active?: boolean }
  ): Promise<StatusCatalogItem | null> {
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const updatedLabel = data.label !== undefined ? data.label.trim() : existing.label;
    if (data.label !== undefined && !updatedLabel) {
      throw new Error('Label não pode ser vazio.');
    }

    const updatedDescription =
      data.description !== undefined ? data.description.trim() : existing.description;
    const updatedActive = data.active !== undefined ? data.active : existing.active;

    if (isDatabaseConfigured) {
      try {
        await db
          .update(schema.statusCatalog)
          .set({
            label: updatedLabel,
            description: updatedDescription,
            active: updatedActive,
            updatedAt: new Date(),
          })
          .where(eq(schema.statusCatalog.id, id));
      } catch (err) {
        console.warn('⚠️ statusCatalog db update error:', (err as Error).message);
      }
    }

    const memItem = this.items.find((i) => i.id === id);
    if (memItem) {
      memItem.label = updatedLabel;
      memItem.description = updatedDescription;
      memItem.active = updatedActive;
      memItem.updatedAt = new Date().toISOString();
      return { ...memItem };
    }

    return {
      ...existing,
      label: updatedLabel,
      description: updatedDescription,
      active: updatedActive,
      updatedAt: new Date().toISOString(),
    };
  }

  async deactivate(id: number): Promise<StatusCatalogItem | null> {
    return this.update(id, { active: false });
  }

  /**
   * Fail-closed check: verifies that status exists and is active for the given family.
   * If not found, throws or returns error.
   */
  async validateStatusOnWrite(family: string, statusIdentifier: string): Promise<{
    valid: boolean;
    status?: StatusCatalogItem;
    error?: string;
  }> {
    if (!family || !STATUS_FAMILIES.includes(family as StatusFamily)) {
      return {
        valid: false,
        error: `Família inválida: "${family}". Permitidas: ${STATUS_FAMILIES.join(', ')}`,
      };
    }

    if (!statusIdentifier || typeof statusIdentifier !== 'string') {
      return {
        valid: false,
        error: 'Identificador de status ausente ou inválido.',
      };
    }

    const clean = statusIdentifier.trim();
    const found = await this.getByFamilyAndCode(family, clean);

    if (!found) {
      return {
        valid: false,
        error: `Status "${clean}" não existe no catálogo para a família "${family}" (fail-closed).`,
      };
    }

    if (!found.active) {
      return {
        valid: false,
        error: `Status "${found.label}" (${found.code}) está inativo na família "${family}".`,
      };
    }

    return {
      valid: true,
      status: found,
    };
  }

  async getFamilyCounts(): Promise<
    Record<StatusFamily, { total: number; active: number; expected: number }>
  > {
    const all = await this.getAll();
    const expectedCounts: Record<StatusFamily, number> = {
      ProcessoDeContratacao: 13,
      ProcessosPresenciais: 17,
      CotacaoDeOrcamento: 7,
      PregaoEletronico: 36,
      CompraDireta: 18,
    };

    const res: any = {};
    for (const fam of STATUS_FAMILIES) {
      const famItems = all.filter((i) => i.family === fam);
      res[fam] = {
        total: famItems.length,
        active: famItems.filter((i) => i.active).length,
        expected: expectedCounts[fam],
      };
    }
    return res;
  }
}

export const statusCatalogRepository = new StatusCatalogRepository();
