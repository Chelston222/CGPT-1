import { normalizePayhipEvent, verifyPayhipSignature } from './_shared/core.mjs';
import { persistEvent } from './_shared/store.mjs';

const MAX_BODY_BYTES = 512 * 1024;

async function forwardEvent(event) {
  const url = Netlify.env.get('OPS_FORWARD_WEBHOOK_URL');
  if (!url) return;
  const token = Netlify.env.get('OPS_FORWARD_WEBHOOK_BEARER');
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(event) });
  if (!response.ok) console.error('Payhip forward webhook failed', response.status);
}

export default async (request, context) => {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) return Response.json({ error: 'payload_too_large' }, { status: 413 });

  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return Response.json({ error: 'payload_too_large' }, { status: 413 });

  let payload;
  try { payload = JSON.parse(raw); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }

  const payhipApiKey = Netlify.env.get('PAYHIP_API_KEY');
  if (!verifyPayhipSignature(payload, payhipApiKey)) {
    return Response.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let event;
  try { event = normalizePayhipEvent(payload); } catch (error) {
    return Response.json({ error: 'invalid_event', message: error.message }, { status: 400 });
  }

  const result = await persistEvent(event);
  context.waitUntil(forwardEvent(event));
  return Response.json({ ok: true, duplicate: result.duplicate }, { status: 200, headers: { 'cache-control': 'no-store' } });
};

export const config = { path: '/api/payhip/webhook' };
