import { webcrypto, scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { sharedEnvConfig } from '../config/env';

const scryptAsync = promisify(scrypt);
const SCRYPT_KEYLEN = 64;

/** Hash a plain secret (e.g. clientSecret) for safe storage. */
export async function hashSecret(plain: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(plain, salt, SCRYPT_KEYLEN)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

/** Verify a plain secret against a stored scrypt hash. */
export async function verifySecret(plain: string, stored: string): Promise<boolean> {
  const [salt, hex] = stored.split(':');
  if (!salt || !hex) return false;
  const storedHash = Buffer.from(hex, 'hex');
  const derivedHash = (await scryptAsync(plain, salt, SCRYPT_KEYLEN)) as Buffer;
  return timingSafeEqual(storedHash, derivedHash);
}

export interface EncryptedString {
  value: string;
  encrypted: boolean;
}

async function getAesKey(): Promise<webcrypto.CryptoKey> {
  const raw = sharedEnvConfig.ENCRYPTION_KEY;
  const keyMaterial = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return webcrypto.subtle.importKey('raw', keyMaterial, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encrypt(es: EncryptedString): Promise<EncryptedString> {
  if (es.encrypted) return es;
  const key = await getAesKey();
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(es.value));
  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), 12);
  return { value: btoa(String.fromCharCode(...combined)), encrypted: true };
}

export async function decrypt(es: EncryptedString): Promise<EncryptedString> {
  if (!es.encrypted) return es;
  const key = await getAesKey();
  const combined = Uint8Array.from(atob(es.value), (c) => c.charCodeAt(0));
  const plaintext = await webcrypto.subtle.decrypt(
    { name: 'AES-GCM', iv: combined.slice(0, 12) },
    key,
    combined.slice(12),
  );
  return { value: new TextDecoder().decode(plaintext), encrypted: false };
}
