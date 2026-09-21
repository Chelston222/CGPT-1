import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { createHash, timingSafeEqual } from 'node:crypto';

const STORE = 'tte-linkedin-media-bridge';
const MAX_CHUNK_BYTES = 3_800_000;
const MAX_FILE_BYTES = 100_000_000;
const SAFE_ID = /^[a-z0-9][a-z0-9-]{2,79}$/i;
const SHA256 = /^[a-f0-9]{64}$/i;

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

function authorised(request: Request) {
  const token = Netlify.env.get('TTE_LINKEDIN_MEDIA_UPLOAD_TOKEN') || '';
  const auth = request.headers.get('authorization') || '';
  return token.length >= 32 && safeEqual(auth, `Bearer ${token}`);
}

function requiredId(url: URL) {
  const id = (url.searchParams.get('id') || '').trim();
  if (!SAFE_ID.test(id)) throw new Error('invalid id');
  return id;
}

function partKey(id: string, part: number) {
  return `${id}/parts/${String(part).padStart(3, '0')}`;
}

function finalKey(id: string) {
  return `${id}/final.pdf`;
}

function manifestKey(id: string) {
  return `${id}/manifest.json`;
}

export default async (request: Request) => {
  const url = new URL(request.url);
  let id: string;
  try { id = requiredId(url); } catch { return json(400, { error: 'invalid_id' }); }
  const store = getStore({ name: STORE, consistency: 'strong' });

  if (request.method === 'GET') {
    const manifest = await store.get(manifestKey(id), { type: 'json' }) as null | { capability?: string; bytes?: number; sha256?: string; ready?: boolean };
    const capability = url.searchParams.get('cap') || '';
    if (!manifest?.ready || !manifest.capability || !safeEqual(capability, manifest.capability)) return json(404, { error: 'not_found' });
    const stream = await store.get(finalKey(id), { type: 'stream' });
    if (!stream) return json(404, { error: 'not_found' });
    return new Response(stream, {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-length': String(manifest.bytes || ''),
        'cache-control': 'private, no-store, max-age=0',
        'content-disposition': 'inline; filename="linkedin-carousel.pdf"',
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
    let payload: { parts?: number; expectedBytes?: number; expectedSha256?: string; capability?: string };
    try { payload = await request.json(); } catch { return json(400, { error: 'invalid_json' }); }
    const parts = Number(payload.parts);
    const expectedBytes = Number(payload.expectedBytes);
    const expectedSha256 = String(payload.expectedSha256 || '').toLowerCase();
    const capability = String(payload.capability || '');
    if (!Number.isInteger(parts) || parts < 1 || parts > 99) return json(400, { error: 'invalid_parts' });
    if (!Number.isInteger(expectedBytes) || expectedBytes < 1 || expectedBytes > MAX_FILE_BYTES) return json(400, { error: 'invalid_expected_bytes' });
    if (!SHA256.test(expectedSha256)) return json(400, { error: 'invalid_expected_sha256' });
    if (capability.length < 32) return json(400, { error: 'invalid_capability' });

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
    if (Buffer.from(merged.subarray(0, 5)).toString('ascii') !== '%PDF-') return json(415, { error: 'not_pdf' });
    const sha256 = createHash('sha256').update(merged).digest('hex');
    if (sha256 !== expectedSha256) return json(409, { error: 'sha256_mismatch', expectedSha256, actualSha256: sha256 });

    await store.set(finalKey(id), merged.buffer);
    await store.setJSON(manifestKey(id), { ready: true, bytes: total, sha256, parts, capability, createdAt: new Date().toISOString() });
    for (let part = 1; part <= parts; part += 1) await store.delete(partKey(id, part));
    return json(200, { ok: true, id, bytes: total, sha256 });
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

// This bridge is transport only. Buffer release authority remains in the governed GitHub queue and approval workflow.
export const config: Config = {
  path: '/api/tte/linkedin-media-bridge',
  method: ['GET', 'PUT', 'POST', 'DELETE'],
};
