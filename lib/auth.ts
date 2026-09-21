import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// Scrypt parameters (recommended by OWASP)
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

/**
 * Hash password using scrypt (Node.js built-in)
 * Format: salt.hash (hex encoded)
 * SERVER-ONLY: Do not import this in client components
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}.${derivedKey.toString('hex')}`;
}

/**
 * Verify password against hash
 * SERVER-ONLY: Do not import this in client components
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    const [salt, key] = hash.split('.');
    if (!salt || !key) return false;

    const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
    const keyBuffer = Buffer.from(key, 'hex');

    return timingSafeEqual(derivedKey, keyBuffer);
  } catch {
    return false;
  }
}
