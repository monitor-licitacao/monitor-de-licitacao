import crypto from 'crypto';

const KEY_LENGTH = 64;

export function hashPassword(plainPassword: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(plainPassword, salt, KEY_LENGTH);
  return `${salt}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(plainPassword: string, storedHash: string): boolean {
  const [salt, hashHex] = storedHash.split(':');
  if (!salt || !hashHex) return false;
  const derivedKey = crypto.scryptSync(plainPassword, salt, KEY_LENGTH);
  const storedKey = Buffer.from(hashHex, 'hex');
  if (derivedKey.length !== storedKey.length) return false;
  return crypto.timingSafeEqual(derivedKey, storedKey);
}
