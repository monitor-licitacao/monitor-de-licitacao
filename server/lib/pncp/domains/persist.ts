import {
  getComprasGovSql,
  upsertEntitySnapshot,
  upsertSourceRecord,
} from '../../sourceLayer.js';
import { PNCP_DOMAIN_SOURCE } from './types.js';
import type {
  NormalizedAmparo,
  NormalizedInstrumento,
  NormalizedModalidade,
  NormalizedTipoAmparo,
} from './types.js';

export type UpsertDomainResult = {
  id: string;
  changed: boolean;
};

async function upsertTipoAmparo(row: NormalizedTipoAmparo): Promise<string> {
  const sql = getComprasGovSql();
  const sourceRecordId = await upsertSourceRecord({
    source: PNCP_DOMAIN_SOURCE,
    entityType: 'pncp_tipo_amparo_legal',
    identifier: String(row.pncpId),
    sourceUrl: 'https://pncp.gov.br/api/pncp/v1/amparos-legais',
    rawPayload: row.rawJson,
  });

  const inserted = await sql<{ id: string; payload_hash: string }[]>`
    INSERT INTO pncp_tipo_amparo_legal (
      pncp_id, nome, descricao, status_ativo, raw_json, payload_hash, source_record_id, updated_at
    )
    VALUES (
      ${row.pncpId}, ${row.nome}, ${row.descricao}, ${row.statusAtivo},
      ${sql.json(row.rawJson as import('postgres').JSONValue)}, ${row.payloadHash},
      ${sourceRecordId}, now()
    )
    ON CONFLICT (pncp_id) DO UPDATE SET
      nome = EXCLUDED.nome,
      descricao = EXCLUDED.descricao,
      status_ativo = EXCLUDED.status_ativo,
      raw_json = EXCLUDED.raw_json,
      payload_hash = EXCLUDED.payload_hash,
      source_record_id = COALESCE(EXCLUDED.source_record_id, pncp_tipo_amparo_legal.source_record_id),
      updated_at = now()
    RETURNING id, payload_hash
  `;

  return inserted[0].id;
}

export async function upsertModalidade(row: NormalizedModalidade): Promise<UpsertDomainResult> {
  const sql = getComprasGovSql();
  const existing = await sql<{ id: string; payload_hash: string }[]>`
    SELECT id, payload_hash FROM pncp_modalidade WHERE pncp_id = ${row.pncpId} LIMIT 1
  `;

  const sourceRecordId = await upsertSourceRecord({
    source: PNCP_DOMAIN_SOURCE,
    entityType: 'pncp_modalidade',
    identifier: String(row.pncpId),
    sourceUrl: 'https://pncp.gov.br/api/pncp/v1/modalidades',
    rawPayload: row.rawJson,
  });

  if (existing[0] && existing[0].payload_hash === row.payloadHash) {
    await sql`
      UPDATE pncp_modalidade
      SET last_seen_at = now(), source_record_id = COALESCE(source_record_id, ${sourceRecordId})
      WHERE id = ${existing[0].id}
    `;
    return { id: existing[0].id, changed: false };
  }

  const inserted = await sql<{ id: string }[]>`
    INSERT INTO pncp_modalidade (
      pncp_id, nome, descricao, irp, status_ativo,
      source_created_at, source_updated_at, raw_json, payload_hash,
      source_record_id, first_seen_at, last_seen_at, updated_at
    )
    VALUES (
      ${row.pncpId}, ${row.nome}, ${row.descricao}, ${row.irp}, ${row.statusAtivo},
      ${row.sourceCreatedAt}, ${row.sourceUpdatedAt},
      ${sql.json(row.rawJson as import('postgres').JSONValue)}, ${row.payloadHash},
      ${sourceRecordId}, now(), now(), now()
    )
    ON CONFLICT (pncp_id) DO UPDATE SET
      nome = EXCLUDED.nome,
      descricao = EXCLUDED.descricao,
      irp = EXCLUDED.irp,
      status_ativo = EXCLUDED.status_ativo,
      source_created_at = EXCLUDED.source_created_at,
      source_updated_at = EXCLUDED.source_updated_at,
      raw_json = EXCLUDED.raw_json,
      payload_hash = EXCLUDED.payload_hash,
      source_record_id = COALESCE(EXCLUDED.source_record_id, pncp_modalidade.source_record_id),
      last_seen_at = now(),
      updated_at = now()
    RETURNING id
  `;

  await upsertEntitySnapshot({
    entityType: 'pncp_modalidade',
    entityId: inserted[0].id,
    source: PNCP_DOMAIN_SOURCE,
    payload: row.rawJson,
  });

  return { id: inserted[0].id, changed: true };
}

export async function upsertInstrumento(row: NormalizedInstrumento): Promise<UpsertDomainResult> {
  const sql = getComprasGovSql();
  const existing = await sql<{ id: string; payload_hash: string }[]>`
    SELECT id, payload_hash FROM pncp_instrumento_convocatorio WHERE pncp_id = ${row.pncpId} LIMIT 1
  `;

  const sourceRecordId = await upsertSourceRecord({
    source: PNCP_DOMAIN_SOURCE,
    entityType: 'pncp_instrumento_convocatorio',
    identifier: String(row.pncpId),
    sourceUrl: 'https://pncp.gov.br/api/pncp/v1/tipos-instrumentos-convocatorios',
    rawPayload: row.rawJson,
  });

  if (existing[0] && existing[0].payload_hash === row.payloadHash) {
    await sql`
      UPDATE pncp_instrumento_convocatorio
      SET last_seen_at = now(), source_record_id = COALESCE(source_record_id, ${sourceRecordId})
      WHERE id = ${existing[0].id}
    `;
    return { id: existing[0].id, changed: false };
  }

  const inserted = await sql<{ id: string }[]>`
    INSERT INTO pncp_instrumento_convocatorio (
      pncp_id, nome, descricao,
      obrigatoriedade_abertura_proposta, obrigatoriedade_encerramento_proposta,
      status_ativo, source_created_at, source_updated_at,
      raw_json, payload_hash, source_record_id, first_seen_at, last_seen_at, updated_at
    )
    VALUES (
      ${row.pncpId}, ${row.nome}, ${row.descricao},
      ${row.obrigatoriedadeAberturaProposta}, ${row.obrigatoriedadeEncerramentoProposta},
      ${row.statusAtivo}, ${row.sourceCreatedAt}, ${row.sourceUpdatedAt},
      ${sql.json(row.rawJson as import('postgres').JSONValue)}, ${row.payloadHash},
      ${sourceRecordId}, now(), now(), now()
    )
    ON CONFLICT (pncp_id) DO UPDATE SET
      nome = EXCLUDED.nome,
      descricao = EXCLUDED.descricao,
      obrigatoriedade_abertura_proposta = EXCLUDED.obrigatoriedade_abertura_proposta,
      obrigatoriedade_encerramento_proposta = EXCLUDED.obrigatoriedade_encerramento_proposta,
      status_ativo = EXCLUDED.status_ativo,
      source_created_at = EXCLUDED.source_created_at,
      source_updated_at = EXCLUDED.source_updated_at,
      raw_json = EXCLUDED.raw_json,
      payload_hash = EXCLUDED.payload_hash,
      source_record_id = COALESCE(EXCLUDED.source_record_id, pncp_instrumento_convocatorio.source_record_id),
      last_seen_at = now(),
      updated_at = now()
    RETURNING id
  `;

  await upsertEntitySnapshot({
    entityType: 'pncp_instrumento_convocatorio',
    entityId: inserted[0].id,
    source: PNCP_DOMAIN_SOURCE,
    payload: row.rawJson,
  });

  return { id: inserted[0].id, changed: true };
}

export async function upsertAmparo(row: NormalizedAmparo): Promise<UpsertDomainResult> {
  const sql = getComprasGovSql();
  const tipoId = row.tipo ? await upsertTipoAmparo(row.tipo) : null;

  const existing = await sql<{ id: string; payload_hash: string }[]>`
    SELECT id, payload_hash FROM pncp_amparo_legal WHERE pncp_id = ${row.pncpId} LIMIT 1
  `;

  const sourceRecordId = await upsertSourceRecord({
    source: PNCP_DOMAIN_SOURCE,
    entityType: 'pncp_amparo_legal',
    identifier: String(row.pncpId),
    sourceUrl: 'https://pncp.gov.br/api/pncp/v1/amparos-legais',
    rawPayload: row.rawJson,
  });

  if (existing[0] && existing[0].payload_hash === row.payloadHash) {
    await sql`
      UPDATE pncp_amparo_legal
      SET last_seen_at = now(), source_record_id = COALESCE(source_record_id, ${sourceRecordId})
      WHERE id = ${existing[0].id}
    `;
    return { id: existing[0].id, changed: false };
  }

  const inserted = await sql<{ id: string }[]>`
    INSERT INTO pncp_amparo_legal (
      pncp_id, nome, descricao, tipo_amparo_legal_id, status_ativo,
      source_created_at, source_updated_at, raw_json, payload_hash,
      source_record_id, first_seen_at, last_seen_at, updated_at
    )
    VALUES (
      ${row.pncpId}, ${row.nome}, ${row.descricao}, ${tipoId}, ${row.statusAtivo},
      ${row.sourceCreatedAt}, ${row.sourceUpdatedAt},
      ${sql.json(row.rawJson as import('postgres').JSONValue)}, ${row.payloadHash},
      ${sourceRecordId}, now(), now(), now()
    )
    ON CONFLICT (pncp_id) DO UPDATE SET
      nome = EXCLUDED.nome,
      descricao = EXCLUDED.descricao,
      tipo_amparo_legal_id = EXCLUDED.tipo_amparo_legal_id,
      status_ativo = EXCLUDED.status_ativo,
      source_created_at = EXCLUDED.source_created_at,
      source_updated_at = EXCLUDED.source_updated_at,
      raw_json = EXCLUDED.raw_json,
      payload_hash = EXCLUDED.payload_hash,
      source_record_id = COALESCE(EXCLUDED.source_record_id, pncp_amparo_legal.source_record_id),
      last_seen_at = now(),
      updated_at = now()
    RETURNING id
  `;

  await upsertEntitySnapshot({
    entityType: 'pncp_amparo_legal',
    entityId: inserted[0].id,
    source: PNCP_DOMAIN_SOURCE,
    payload: row.rawJson,
  });

  return { id: inserted[0].id, changed: true };
}
