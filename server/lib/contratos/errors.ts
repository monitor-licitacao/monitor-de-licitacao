export const CONTRATO_JA_NO_PAINEL = 'Este contrato já está no painel.';

export function mapTenantContractInsertError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('tenant_contract_pncp_unique') || msg.includes('tenant_contract_manual_unique')) {
    return new Error(CONTRATO_JA_NO_PAINEL);
  }
  return err instanceof Error ? err : new Error(msg);
}
