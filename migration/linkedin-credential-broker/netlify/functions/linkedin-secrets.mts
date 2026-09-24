import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const STORE_NAME = 'linkedin-private-ops-credential-broker';
const CREDENTIAL_KEY = 'buffer-credentials-v1.enc.json';
const AUDIENCE = '222emails-linkedin-bridge-v1';
const BOOTSTRAP_REPO = 'Chelston222/CGPT-1';
const PRIVATE_REPO = 'Chelston222/222emails-linkedin-ops';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function encryptionKey() {
  const source = Netlify.env.get('LINKEDIN_PROXY_ENCRYPTION_KEY') || '';
  if (source.length < 32) throw new Error('broker encryption key is not configured');
  return createHash('sha256').update(source).digest();
}

function encrypt(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const plain = Buffer.from(JSON.stringify(value), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({ v: 1, iv: iv.toString('base64url'), tag: tag.toString('base64url'), data: encrypted.toString('base64url') });
}

function decrypt(raw: string) {
  const payload = JSON.parse(raw);
  if (payload?.v !== 1) throw new Error('unsupported broker record');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(payload.iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64url'));
  const plain = Buffer.concat([decipher.update(Buffer.from(payload.data, 'base64url')), decipher.final()]);
  return JSON.parse(plain.toString('utf8'));
}

async function claimsFor(request: Request) {
  const header = request.headers.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/.exec(header);
  if (!match) throw new Error('missing bearer token');
  const jwks = createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'));
  const verified = await jwtVerify(match[1], jwks, { issuer: 'https://token.actions.githubusercontent.com', audience: AUDIENCE });
  const repository = String(verified.payload.repository || '');
  const owner = String(verified.payload.repository_owner || '');
  if (owner !== 'Chelston222') throw new Error('unexpected repository owner');
  return { repository };
}

function validCredentialPayload(body: any) {
  const bufferApiKey = String(body?.bufferApiKey || '').trim();
  const personal = String(body?.channels?.personal || '').trim();
  const main = String(body?.channels?.main || '').trim();
  const secondary = String(body?.channels?.secondary || '').trim();
  if (bufferApiKey.length < 20) throw new Error('invalid Buffer API credential');
  if ([personal, main, secondary].some((value) => value.length < 3)) throw new Error('invalid Buffer channel configuration');
  return { bufferApiKey, channels: { personal, main, secondary } };
}

export default async (request: Request) => {
  try {
    const { repository } = await claimsFor(request);
    const store = getStore(STORE_NAME);

    if (request.method === 'POST') {
      if (repository !== BOOTSTRAP_REPO) return json(403, { error: 'bootstrap_repo_required' });
      const existing = await store.get(CREDENTIAL_KEY, { type: 'text' });
      if (existing) return json(409, { error: 'already_bootstrapped' });
      const body = await request.json().catch(() => null);
      const credentials = validCredentialPayload(body);
      await store.set(CREDENTIAL_KEY, encrypt({ ...credentials, bootstrappedAt: new Date().toISOString(), sourceRepository: repository }));
      return json(201, { ok: true, configured: true });
    }

    if (request.method === 'GET') {
      if (repository !== PRIVATE_REPO) return json(403, { error: 'private_ops_repo_required' });
      const raw = await store.get(CREDENTIAL_KEY, { type: 'text' });
      if (!raw) return json(404, { error: 'not_configured' });
      const credentials = decrypt(raw);
      return json(200, { bufferApiKey: credentials.bufferApiKey, channels: credentials.channels });
    }

    return json(405, { error: 'method_not_allowed' });
  } catch (error: any) {
    return json(401, { error: 'unauthorised', detail: String(error?.message || 'request rejected') });
  }
};

export const config: Config = { path: '/api/linkedin-secrets', method: ['GET', 'POST'] };
