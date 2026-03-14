import { webcrypto } from 'crypto';

export interface EncryptedString {
  value: string;
  encrypted: boolean;
}

async function getAesKey(): Promise<webcrypto.CryptoKey> {
  const raw = process.env['ENCRYPTION_KEY'];
  if (!raw) throw new Error('ENCRYPTION_KEY env var is not set');
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
