import { timingSafeEqual } from 'node:crypto';
import { jsonResponse } from './util.mjs';

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export function bridgeToken() { return Netlify.env.get('TTE_BRIDGE_TOKEN') || ''; }
export function encryptionKey() { return Netlify.env.get('TTE_TOKEN_ENCRYPTION_KEY') || ''; }
export function previousEncryptionKey() { return Netlify.env.get('TTE_TOKEN_ENCRYPTION_KEY_PREVIOUS') || ''; }
export function decryptionKeys() { return [encryptionKey(), previousEncryptionKey()].filter((x, i, a) => x && a.indexOf(x) === i); }
export function googleClientId() { return Netlify.env.get('GOOGLE_OAUTH_CLIENT_ID') || ''; }
export function googleClientSecret() { return Netlify.env.get('GOOGLE_OAUTH_CLIENT_SECRET') || ''; }
export function authorised(req) {
  const token = bridgeToken();
  const auth = req.headers.get('authorization') || '';
  return token.length >= 24 && safeEqual(auth, `Bearer ${token}`);
}
export function requireAuth(req) {
  if (!authorised(req)) return jsonResponse(401, { error: 'unauthorised' });
  return null;
}
export function configStatus() {
  const bridge = bridgeToken(); const enc = encryptionKey();
  return {
    bridgeToken: bridge.length >= 24,
    encryptionKey: enc.length >= 24,
    keysDistinct: bridge.length >= 24 && enc.length >= 24 && bridge !== enc,
    googleOAuthClientId: Boolean(googleClientId()),
    googleOAuthClientSecret: Boolean(googleClientSecret()),
  };
}
export function assertCoreSecrets() {
  const status = configStatus();
  const missing = Object.entries(status).filter(([, ok]) => !ok).map(([k]) => k);
  if (missing.length) throw new Error(`Missing required configuration: ${missing.join(', ')}`);
}
