/**
 * Reseta a senha de um usuário na tabela users (Neon/Postgres).
 *
 * Uso:
 *   npm run auth:reset-password -- --email admin@tenant.com --password 'NovaSenha123!'
 *   npm run auth:reset-password -- --email admin@tenant.com
 *     (sem --password: gera senha aleatória e imprime uma vez)
 */
import crypto from 'crypto';
import 'dotenv/config';
import postgres from 'postgres';
import { hashPassword } from '../server/lib/password.js';

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return undefined;
  return process.argv[idx + 1];
}

function generatePassword(length = 16): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

async function main() {
  const email = readArg('--email') ?? 'admin@tenant.com';
  let password = readArg('--password');
  const generated = !password;

  if (generated) {
    password = generatePassword();
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL não configurada (.env)');
    process.exit(1);
  }

  const sql = postgres(connectionString, { max: 1 });

  try {
    const rows = await sql<{ id: string; tenant_id: number; name: string; email: string }[]>`
      SELECT id, tenant_id, name, email FROM users WHERE email = ${email} LIMIT 1
    `;
    const user = rows[0];

    if (!user) {
      console.error(`Usuário não encontrado: ${email}`);
      process.exit(1);
    }

    const passwordHash = hashPassword(password!);
    await sql`
      UPDATE users SET password_hash = ${passwordHash} WHERE email = ${email}
    `;

    console.log(`Senha atualizada para ${email} (id: ${user.id}, tenant: ${user.tenant_id})`);
    if (generated) {
      console.log('');
      console.log('Nova senha (copie agora — não será exibida de novo):');
      console.log(password);
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
