import type { ContratacaoGrupo, ContratacaoItemRico } from '../compras-gov/normalize-contratacao-itens.js';
import { parseNumeroControlePncp } from '../pncp/resolve-controle.js';
import { stripCnpj } from './cnpj-lookup.js';
import type { ManualContractItemInput } from './types.js';

export type NumeroContratoTipo = 'pncp' | 'processo' | 'edital' | 'compra';

export type NumeroSugerido = {
  tipo: NumeroContratoTipo;
  label: string;
  valor: string;
};

const NUMERO_LABELS: Record<NumeroContratoTipo, string> = {
  pncp: 'Controle PNCP',
  processo: 'Processo',
  edital: 'Edital / Compra',
  compra: 'Nº compra',
};

export function buildNumerosSugeridos(input: {
  numero_controle_pncp: string;
  numero_processo?: string | null;
  edital?: string | null;
  numero_compra?: string | null;
}): NumeroSugerido[] {
  const out: NumeroSugerido[] = [];
  const push = (tipo: NumeroContratoTipo, valor: string | null | undefined) => {
    const v = valor?.trim();
    if (!v || v === '—') return;
    if (out.some((o) => o.valor === v)) return;
    out.push({ tipo, label: NUMERO_LABELS[tipo], valor: v });
  };

  push('pncp', input.numero_controle_pncp);
  push('processo', input.numero_processo);
  push('edital', input.edital);
  push('compra', input.numero_compra);

  return out;
}

export function hasStructuredGrupos(grupos: ContratacaoGrupo[]): boolean {
  return !(grupos.length === 1 && grupos[0]?.identificador === 'ALL');
}

export function flattenContratacaoItens(detail: {
  itens_avulsos?: ContratacaoItemRico[];
  grupos?: ContratacaoGrupo[];
  itens?: ContratacaoItemRico[];
}): ContratacaoItemRico[] {
  const grupos = detail.grupos ?? [];
  const avulsos = detail.itens_avulsos ?? [];
  const fromGrupos = grupos.flatMap((g) => g.itens ?? []);

  if (hasStructuredGrupos(grupos)) {
    return dedupeItensByNumero([...fromGrupos, ...avulsos]);
  }

  if (fromGrupos.length > 0) return dedupeItensByNumero(fromGrupos);
  if (avulsos.length > 0) return dedupeItensByNumero(avulsos);

  return detail.itens ?? [];
}

function dedupeItensByNumero(itens: ContratacaoItemRico[]): ContratacaoItemRico[] {
  const byNumero = new Map<number, ContratacaoItemRico>();
  for (const item of itens) {
    byNumero.set(item.numero_item, item);
  }
  return Array.from(byNumero.values()).sort((a, b) => a.numero_item - b.numero_item);
}

export function resolveFilteredItens(
  grupos: ContratacaoGrupo[],
  itensAvulsos: ContratacaoItemRico[],
  filter: string,
): ContratacaoItemRico[] {
  if (filter === 'ALL') {
    return flattenContratacaoItens({ grupos, itens_avulsos: itensAvulsos });
  }
  if (filter === 'AVULSOS') return dedupeItensByNumero(itensAvulsos);
  return dedupeItensByNumero(grupos.find((g) => g.identificador === filter)?.itens ?? []);
}

export function resolveRegisterPrefillItens(
  grupos: ContratacaoGrupo[],
  itensAvulsos: ContratacaoItemRico[],
  grupoFilter: string = 'ALL',
  itemNumero?: number | null,
): ContratacaoItemRico[] {
  let itens = resolveFilteredItens(grupos, itensAvulsos, grupoFilter);
  if (itemNumero != null) {
    itens = itens.filter((item) => item.numero_item === itemNumero);
  }
  return itens;
}

export function filterItensByNumeros(
  itens: ContratacaoItemRico[],
  itemNumeros?: number[],
): ContratacaoItemRico[] {
  if (!itemNumeros?.length) return itens;
  const set = new Set(itemNumeros);
  return itens.filter((i) => set.has(i.numero_item));
}

export function itemDescricao(item: ContratacaoItemRico): string {
  return (
    item.nome_comercial?.split('\n')[0]?.trim() ||
    item.descricao_resumida?.trim() ||
    item.descricao_detalhada?.trim() ||
    `Item ${item.numero_item}`
  );
}

export function mapContratacaoItemToManualInput(item: ContratacaoItemRico): ManualContractItemInput {
  const materialOuServico =
    item.material_ou_servico?.toLowerCase() === 'servico'
      ? 'servico'
      : item.material_ou_servico?.toLowerCase() === 'material'
        ? 'material'
        : item.catalogo_tipo === 'CATSER'
          ? 'servico'
          : item.catalogo_tipo === 'CATMAT'
            ? 'material'
            : undefined;

  return {
    descricao: itemDescricao(item),
    quantidade: item.quantidade,
    unidade_medida: item.unidade || undefined,
    valor_unitario: item.orcamento_sigiloso ? undefined : item.valor_unitario ?? undefined,
    valor_total: item.orcamento_sigiloso ? undefined : item.valor_total ?? undefined,
    catalogo_codigo_item: item.codigo_catalogo ?? undefined,
    material_ou_servico: materialOuServico,
  };
}

export function sumItensNaoSigilosos(itens: ContratacaoItemRico[]): number {
  return itens.reduce((acc, item) => {
    if (item.orcamento_sigiloso) return acc;
    if (item.valor_total != null) return acc + item.valor_total;
    if (item.valor_unitario != null && item.quantidade) {
      return acc + item.valor_unitario * item.quantidade;
    }
    return acc;
  }, 0);
}

/** CNPJ do órgão: coluna contratacao.cnpj_orgao ou prefixo do numero_controle_pncp. */
export function resolveOrgaoCnpjFromContratacaoMeta(input: {
  cnpj_orgao?: string | null;
  numero_controle_pncp?: string | null;
}): string {
  const fromColumn = stripCnpj(input.cnpj_orgao ?? '');
  if (fromColumn.length === 14) return fromColumn;

  const parsed = input.numero_controle_pncp
    ? parseNumeroControlePncp(input.numero_controle_pncp)
    : null;
  if (parsed?.cnpj.length === 14) return parsed.cnpj;

  return fromColumn;
}

export function validateManualFromContratacao(input: {
  contratacao_id?: string;
  numero_contrato_empenho?: string;
}): string | null {
  if (!input.contratacao_id?.trim()) {
    return 'Selecione uma contratação de origem.';
  }
  if (!input.numero_contrato_empenho?.trim()) {
    return 'Selecione o número do contrato.';
  }
  return null;
}
