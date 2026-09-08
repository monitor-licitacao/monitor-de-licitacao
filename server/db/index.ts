import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import 'dotenv/config';

export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

if (!isDatabaseConfigured) {
  console.warn('⚠️ DATABASE_URL is not set. Database queries will require DATABASE_URL in environment.');
}

const connectionString = process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/placeholder';
const sql = neon(connectionString);
export const db = drizzle(sql, { schema });
