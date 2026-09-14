export function isContratacaoAnulada(input: {
  situacao?: string | null;
  historico?: Array<{ evento?: string; event_code?: string }>;
}): boolean {
  const situacao = input.situacao?.toLowerCase() ?? '';
  if (situacao.includes('anulad')) return true;
  return (input.historico ?? []).some((evento) => {
    if (evento.event_code === 'CONTRATACAO_ANULADA') return true;
    return (evento.evento ?? '').toLowerCase().includes('anula');
  });
}
