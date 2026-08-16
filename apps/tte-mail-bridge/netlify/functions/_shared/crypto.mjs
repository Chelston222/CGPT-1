import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { base64UrlDecode, base64UrlEncode } from './util.mjs';

function keyFromSecret(secret) {
  if (!secret || String(secret).length < 24) throw new Error('TTE_TOKEN_ENCRYPTION_KEY must be at least 24 characters');
  return createHash('sha256').update(String(secret)).digest();
}
export function encryptJson(value, secret, aad = '') {
  const key = keyFromSecret(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  if (aad) cipher.setAAD(Buffer.from(String(aad), 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { v: 1, alg: 'A256GCM', iv: iv.toString('base64url'), tag: tag.toString('base64url'), data: ciphertext.toString('base64url') };
}
export function decryptJson(envelope, secret, aad = '') {
  if (!envelope || envelope.v !== 1 || envelope.alg !== 'A256GCM') throw new Error('Unsupported encrypted envelope');
  const key = keyFromSecret(secret);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64url'));
  if (aad) decipher.setAAD(Buffer.from(String(aad), 'utf8'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64url'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64url')), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8'));
}
export function decryptJsonAny(envelope, secrets, aad = '') {
  let lastError;
  for (const secret of secrets || []) {
    try { return decryptJson(envelope, secret, aad); } catch (err) { lastError = err; }
  }
  throw lastError || new Error('No decryption key available');
}
export function signState(payload, secret) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = createHmac('sha256', keyFromSecret(secret)).update(body).digest('base64url');
  return `${body}.${sig}`;
}
export function verifyState(token, secret) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) throw new Error('Invalid OAuth state');
  const expected = createHmac('sha256', keyFromSecret(secret)).update(body).digest();
  const actual = Buffer.from(sig, 'base64url');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error('Invalid OAuth state signature');
  const payload = JSON.parse(base64UrlDecode(body));
  if (!payload.exp || Date.now() > Number(payload.exp)) throw new Error('OAuth state expired');
  return payload;
}
