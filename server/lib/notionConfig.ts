/**
 * Mapeamento seguro de tenantId -> Notion databaseId
 * Previne IDOR ao aceitar databaseId apenas do lado do servidor
 *
 * Em produção, carregar isso de um banco de dados (tenantConfigs) em vez de hardcoded
 */

const TENANT_NOTION_DATABASES: Record<number, string> = {
  // Formato: tenantId -> notionDatabaseId (32 hex chars)
  // Exemplo: 1 -> 'd1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'

  // Para teste local, usar um databaseId válido de desenvolvimento
  // Obter em https://notion.so -> compartilhado -> copiar ID database
  1: process.env.NOTION_DB_TENANT_1 || '',
};

/**
 * Obtém o databaseId permitido para um tenant
 * @param tenantId ID do tenant autenticado
 * @returns databaseId se tenant existe e está autorizado, null caso contrário
 */
export function getAllowedDatabaseForTenant(tenantId?: number): string | null {
  if (!tenantId) return null;

  const databaseId = TENANT_NOTION_DATABASES[tenantId];
  if (!databaseId) {
    console.warn(`[Notion] Tenant ${tenantId} não tem databaseId configurado`);
    return null;
  }

  return databaseId;
}

/**
 * Em produção, substituir por:
 *
 * export async function getAllowedDatabaseForTenant(tenantId?: number): Promise<string | null> {
 *   if (!tenantId) return null;
 *   const config = await db.select().from(schema.tenantConfigs)
 *     .where(eq(schema.tenantConfigs.tenantId, tenantId));
 *   return config[0]?.notionDatabaseId || null;
 * }
 */
