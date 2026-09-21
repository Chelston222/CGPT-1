import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const STORE = 'tte-linkedin-media-bridge';
const MAX_CHUNK_BYTES = 3_800_000;
const MAX_FILE_BYTES = 100_000_000;
const SAFE_ID = /^[a-z0-9][a-z0-9-]{2,79}$/i;
const SHA256 = /^[a-f0-9]{64}$/i;
const SAFE_FILENAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/;
const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

function deriveUploadToken(secret: string) {
  return secret.length >= 16
    ? createHmac('sha256', secret).update('tte-linkedin-media-upload-v1').digest('base64url')
    : '';
}

function authorised(request: Request) {
  const dedicated = Netlify.env.get('TTE_LINKEDIN_MEDIA_UPLOAD_TOKEN') || '';
  const smtpDerived = deriveUploadToken(Netlify.env.get('TTE_SMTP_PASS') || '');
  const bridge = Netlify.env.get('TTE_BRIDGE_TOKEN') || '';
  const token = dedicated.length >= 32 ? dedicated : (smtpDerived || bridge);
  const auth = request.headers.get('authorization') || '';
  return token.length >= 24 && safeEqual(auth, `Bearer ${token}`);
}

function requiredId(url: URL) {
  const id = (url.searchParams.get('id') || '').trim();
  if (!SAFE_ID.test(id)) throw new Error('invalid id');
  return id;
}

function partKey(id: string, part: number) {
  return `${id}/parts/${String(part).padStart(3, '0')}`;
}

// Keep the historical object key for backward compatibility with already-staged PDFs.
// The blob key extension is not used to infer response MIME type.
function finalKey(id: string) {
  return `${id}/final.pdf`;
}

function manifestKey(id: string) {
  return `${id}/manifest.json`;
}

function contentType(value: unknown) {
  return String(value || '').split(';')[0].trim().toLowerCase();
}

function signatureMatches(bytes: Uint8Array, type: string) {
  const b = Buffer.from(bytes);
  if (type === 'application/pdf') return b.subarray(0, 5).toString('ascii') === '%PDF-';
  if (type === 'image/jpeg') return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (type === 'image/png') return b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (type === 'image/gif') return ['GIF87a','GIF89a'].includes(b.subarray(0, 6).toString('ascii'));
  if (type === 'image/webp') return b.length >= 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP';
  if (type === 'image/heic' || type === 'image/heif') return b.length >= 12 && b.subarray(4, 8).toString('ascii') === 'ftyp';
  return false;
}

function defaultFilename(type: string) {
  const ext = type === 'application/pdf' ? 'pdf'
    : type === 'image/jpeg' ? 'jpg'
    : type === 'image/png' ? 'png'
    : type === 'image/webp' ? 'webp'
    : type === 'image/gif' ? 'gif'
    : type === 'image/heic' ? 'heic'
    : 'heif';
  return `linkedin-media.${ext}`;
}

export default async (request: Request) => {
  const url = new URL(request.url);
  let id: string;
  try { id = requiredId(url); } catch { return json(400, { error: 'invalid_id' }); }
  const store = getStore({ name: STORE, consistency: 'strong' });

  if (request.method === 'GET') {
    const manifest = await store.get(manifestKey(id), { type: 'json' }) as null | {
      capability?: string;
      bytes?: number;
      sha256?: string;
      ready?: boolean;
      contentType?: string;
      filename?: string;
    };
    const capability = url.searchParams.get('cap') || '';
    if (!manifest?.ready || !manifest.capability || !safeEqual(capability, manifest.capability)) return json(404, { error: 'not_found' });
    const stream = await store.get(finalKey(id), { type: 'stream' });
    if (!stream) return json(404, { error: 'not_found' });
    const type = contentType(manifest.contentType) || 'application/pdf';
    const filename = SAFE_FILENAME.test(String(manifest.filename || '')) ? String(manifest.filename) : defaultFilename(type);
    return new Response(stream, {
      status: 200,
      headers: {
        'content-type': type,
        'content-length': String(manifest.bytes || ''),
        'cache-control': 'private, no-store, max-age=0',
        'content-disposition': `inline; filename="${filename}"`,
        'x-content-type-options': 'nosniff',
        'x-file-sha256': String(manifest.sha256 || ''),
      },
    });
  }

  if (!authorised(request)) return json(401, { error: 'unauthorised' });

  if (request.method === 'PUT') {
    const part = Number(url.searchParams.get('part'));
    if (!Number.isInteger(part) || part < 1 || part > 99) return json(400, { error: 'invalid_part' });
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_CHUNK_BYTES) return json(413, { error: 'invalid_chunk_size', maxBytes: MAX_CHUNK_BYTES });
    await store.set(partKey(id, part), bytes.buffer);
    return json(200, { ok: true, id, part, bytes: bytes.length });
  }

  if (request.method === 'POST') {
    let payload: {
      parts?: number;
      expectedBytes?: number;
      expectedSha256?: string;
      capability?: string;
      contentType?: string;
      filename?: string;
    };
    try { payload = await request.json(); } catch { return json(400, { error: 'invalid_json' }); }

    const parts = Number(payload.parts);
    const expectedBytes = Number(payload.expectedBytes);
    const expectedSha256 = String(payload.expectedSha256 || '').toLowerCase();
    const capability = String(payload.capability || '');
    const type = contentType(payload.contentType || 'application/pdf');
    const filename = String(payload.filename || defaultFilename(type));

    if (!Number.isInteger(parts) || parts < 1 || parts > 99) return json(400, { error: 'invalid_parts' });
    if (!Number.isInteger(expectedBytes) || expectedBytes < 1 || expectedBytes > MAX_FILE_BYTES) return json(400, { error: 'invalid_expected_bytes' });
    if (!SHA256.test(expectedSha256)) return json(400, { error: 'invalid_expected_sha256' });
    if (capability.length < 32) return json(400, { error: 'invalid_capability' });
    if (!ALLOWED_CONTENT_TYPES.has(type)) return json(415, { error: 'unsupported_content_type' });
    if (!SAFE_FILENAME.test(filename)) return json(400, { error: 'invalid_filename' });

    const buffers: Uint8Array[] = [];
    let total = 0;
    for (let part = 1; part <= parts; part += 1) {
      const data = await store.get(partKey(id, part), { type: 'arrayBuffer' }) as ArrayBuffer | null;
      if (!data) return json(409, { error: 'missing_part', part });
      const chunk = new Uint8Array(data);
      total += chunk.length;
      if (total > MAX_FILE_BYTES) return json(413, { error: 'file_too_large' });
      buffers.push(chunk);
    }
    if (total !== expectedBytes) return json(409, { error: 'byte_mismatch', expectedBytes, actualBytes: total });

    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of buffers) { merged.set(chunk, offset); offset += chunk.length; }

    if (!signatureMatches(merged, type)) return json(415, { error: 'content_signature_mismatch' });

    const sha256 = createHash('sha256').update(merged).digest('hex');
    if (sha256 !== expectedSha256) return json(409, { error: 'sha256_mismatch', expectedSha256, actualSha256: sha256 });

    await store.set(finalKey(id), merged.buffer);
    await store.setJSON(manifestKey(id), {
      ready: true,
      bytes: total,
      sha256,
      parts,
      capability,
      contentType: type,
      filename,
      createdAt: new Date().toISOString(),
    });
    for (let part = 1; part <= parts; part += 1) await store.delete(partKey(id, part));
    return json(200, { ok: true, id, bytes: total, sha256, contentType: type, filename });
  }

  if (request.method === 'DELETE') {
    const manifest = await store.get(manifestKey(id), { type: 'json' }) as null | { parts?: number };
    await store.delete(finalKey(id));
    await store.delete(manifestKey(id));
    for (let part = 1; part <= Math.min(Number(manifest?.parts || 99), 99); part += 1) await store.delete(partKey(id, part));
    return json(200, { ok: true, id, deleted: true });
  }

  return json(405, { error: 'method_not_allowed' });
};

// Transport only. Publication authority remains in the governed LinkedIn queue
// and repository-owner approval workflow.
export const config: Config = {
  path: '/api/tte/linkedin-media-bridge',
  method: ['GET', 'PUT', 'POST', 'DELETE'],
};
