import type { VigenciaExpectativa } from './types.js';

export type ContratacaoVigenciaContext = {
  dataVigenciaInicio?: string | null;
  dataVigenciaFim?: string | null;
  situacao?: string | null;
  srp?: boolean | null;
  modalidadeIrp?: boolean | null;
  instrumentoObrigatoriedadeEncerramento?: string | null;
  instrumentoNome?: string | null;
};

function hasVigenciaPreenchida(input: ContratacaoVigenciaContext): boolean {
  return Boolean(input.dataVigenciaInicio && input.dataVigenciaFim);
}

export function resolveVigenciaExpectativa(
  input: ContratacaoVigenciaContext,
): VigenciaExpectativa {
  if (hasVigenciaPreenchida(input)) return 'preenchida';

  const situacao = input.situacao?.toLowerCase() ?? '';
  if (situacao.includes('anulada')) return 'nao_aplicavel';

  const instrumento = input.instrumentoNome?.toLowerCase() ?? '';
  if (instrumento.includes('não se aplica') || instrumento.includes('nao se aplica')) {
    return 'nao_aplicavel';
  }

  if (input.srp === true || input.modalidadeIrp === true) {
    return 'aguardando_ata';
  }

  const encerramento = input.instrumentoObrigatoriedadeEncerramento?.toLowerCase() ?? '';
  if (encerramento.includes('obrigat')) {
    return 'aguardando_contrato';
  }

  if (encerramento.includes('não se aplica') || encerramento.includes('nao se aplica')) {
    return 'nao_aplicavel';
  }

  return 'aguardando_contrato';
}

export function vigenciaExpectativaLabel(expectativa: VigenciaExpectativa): string {
  switch (expectativa) {
    case 'preenchida':
      return 'Vigência informada';
    case 'aguardando_contrato':
      return 'Aguardando contrato PNCP';
    case 'aguardando_ata':
      return 'Aguardando ata PNCP';
    case 'nao_aplicavel':
      return 'Vigência não aplicável';
  }
}

export function vigenciaPendente(expectativa: VigenciaExpectativa): boolean {
  return expectativa === 'aguardando_contrato' || expectativa === 'aguardando_ata';
}
