import { jsPDF } from 'jspdf';
import { getComprasGovSql } from '../sourceLayer.js';
import type { OficioTipo, TenantContractRow } from './types.js';

export type OficioRow = {
  id: string;
  tenant_contract_id: string;
  tipo: OficioTipo;
  assunto: string;
  corpo: string;
  status: string;
  email_orgao: string | null;
  email_cliente: string | null;
  enviado_em: string | null;
  pdf_storage_key: string | null;
  created_at: string;
  updated_at: string;
};

export function buildOficioTemplate(
  tipo: OficioTipo,
  contract: TenantContractRow,
): { assunto: string; corpo: string } {
  const orgao = contract.orgao_razao_social ?? contract.orgao_cnpj;
  const numero = contract.numero_contrato_empenho ?? contract.numero_controle_pncp ?? 's/n';
  const vigenciaFim = contract.data_vigencia_fim ?? '—';
  const valor = contract.valor_global ?? '—';

  switch (tipo) {
    case 'renovacao':
      return {
        assunto: `Solicitação de renovação — Contrato ${numero}`,
        corpo: `Prezados(as),\n\nEncaminhamos solicitação formal de renovação do contrato nº ${numero}, firmado com ${orgao}, referente a ${contract.objeto ?? 'objeto contratado'}.\n\nVigência atual encerra em ${vigenciaFim}. Valor global: R$ ${valor}.\n\nAtenciosamente,\n${contract.fornecedor_razao_social ?? contract.fornecedor_cnpj}`,
      };
    case 'reajuste':
      return {
        assunto: `Pedido de reajuste — Contrato ${numero}`,
        corpo: `Prezados(as),\n\nSolicitamos aplicação de reajuste contratual (${contract.indice_reajuste ?? 'índice acordado'}) sobre o contrato nº ${numero} com ${orgao}.\n\nValor reajustado proposto: R$ ${contract.valor_reajustado ?? valor}.\n\nAtenciosamente,\n${contract.fornecedor_razao_social ?? contract.fornecedor_cnpj}`,
      };
    case 'encerramento':
    default:
      return {
        assunto: `Comunicação de encerramento — Contrato ${numero}`,
        corpo: `Prezados(as),\n\nComunicamos o encerramento formal do contrato nº ${numero} com ${orgao}, vigência até ${vigenciaFim}.\n\nSolicitamos confirmação de quitação e eventuais pendências.\n\nAtenciosamente,\n${contract.fornecedor_razao_social ?? contract.fornecedor_cnpj}`,
      };
  }
}

export function renderOficioPdf(assunto: string, corpo: string): Buffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFontSize(14);
  doc.text(assunto, 15, 20, { maxWidth: 180 });
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(corpo, 180);
  doc.text(lines, 15, 35);
  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

export async function listOficios(contractId: string): Promise<OficioRow[]> {
  const sql = getComprasGovSql();
  return sql<OficioRow[]>`
    SELECT * FROM tenant_contract_oficio
    WHERE tenant_contract_id = ${contractId}
    ORDER BY created_at DESC
  `;
}

export async function createOficio(input: {
  contractId: string;
  tipo: OficioTipo;
  assunto?: string;
  corpo?: string;
  contract: TenantContractRow;
}): Promise<OficioRow> {
  const sql = getComprasGovSql();
  const template = buildOficioTemplate(input.tipo, input.contract);
  const rows = await sql<OficioRow[]>`
    INSERT INTO tenant_contract_oficio (
      tenant_contract_id, tipo, assunto, corpo, status, updated_at
    )
    VALUES (
      ${input.contractId},
      ${input.tipo},
      ${input.assunto ?? template.assunto},
      ${input.corpo ?? template.corpo},
      'gerado',
      now()
    )
    RETURNING *
  `;
  return rows[0];
}

export async function getOficioById(oficioId: string): Promise<OficioRow | null> {
  const sql = getComprasGovSql();
  const rows = await sql<OficioRow[]>`
    SELECT * FROM tenant_contract_oficio WHERE id = ${oficioId} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function updateOficio(
  oficioId: string,
  patch: { assunto?: string; corpo?: string; status?: string },
): Promise<OficioRow | null> {
  const sql = getComprasGovSql();
  const current = await getOficioById(oficioId);
  if (!current) return null;
  const rows = await sql<OficioRow[]>`
    UPDATE tenant_contract_oficio
    SET
      assunto = ${patch.assunto ?? current.assunto},
      corpo = ${patch.corpo ?? current.corpo},
      status = ${patch.status ?? current.status},
      updated_at = now()
    WHERE id = ${oficioId}
    RETURNING *
  `;
  return rows[0] ?? null;
}

export async function sendOficioEmail(input: {
  oficio: OficioRow;
  emailOrgao: string;
  emailCliente?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY não configurada.' };
  }

  const from = process.env.RESEND_FROM ?? 'onboarding@resend.dev';
  const pdf = renderOficioPdf(input.oficio.assunto, input.oficio.corpo);
  const body = {
    from,
    to: [input.emailOrgao],
    cc: input.emailCliente ? [input.emailCliente] : undefined,
    subject: input.oficio.assunto,
    text: input.oficio.corpo,
    attachments: [
      {
        filename: `oficio-${input.oficio.id.slice(0, 8)}.pdf`,
        content: pdf.toString('base64'),
      },
    ],
  };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err || `Resend HTTP ${res.status}` };
  }

  const sql = getComprasGovSql();
  await sql`
    UPDATE tenant_contract_oficio
    SET status = 'enviado', email_orgao = ${input.emailOrgao},
        email_cliente = ${input.emailCliente ?? null}, enviado_em = now(), updated_at = now()
    WHERE id = ${input.oficio.id}
  `;

  return { ok: true };
}

export async function patchContractReajuste(input: {
  tenantId: number;
  contractId: string;
  indice: string;
  valorReajustado: number;
}): Promise<TenantContractRow | null> {
  const sql = getComprasGovSql();
  const rows = await sql<TenantContractRow[]>`
    UPDATE tenant_contract
    SET indice_reajuste = ${input.indice},
        valor_reajustado = ${input.valorReajustado},
        reajustado_em = now(),
        updated_at = now()
    WHERE id = ${input.contractId} AND tenant_id = ${input.tenantId}
    RETURNING *
  `;
  return rows[0] ?? null;
}
