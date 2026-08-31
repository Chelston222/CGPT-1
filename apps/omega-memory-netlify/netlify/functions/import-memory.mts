import type { Config, Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { mergeRecords } from '../../lib/memory.mjs';

const STORE = 'omega-memory';
const INDEX_KEY = 'memory/index.json';

function reply(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

export default async (req: Request, context: Context) => {
  const token = Netlify.env.get('OMEGA_IMPORT_TOKEN') || Netlify.env.get('OMEGA_MCP_TOKEN');
  if (!token) return reply({ error: 'OMEGA_IMPORT_TOKEN/OMEGA_MCP_TOKEN is not configured; import is fail-closed.' }, 503);
  if ((req.headers.get('authorization') || '') !== `Bearer ${token}`) return reply({ error: 'unauthorised' }, 401);
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);

  let body: any;
  try { body = await req.json(); } catch { return reply({ error: 'invalid_json' }, 400); }
  const incoming = Array.isArray(body?.records) ? body.records : [];
  if (!incoming.length) return reply({ error: 'records_required' }, 400);
  if (incoming.length > 5000) return reply({ error: 'too_many_records' }, 413);

  const safe = incoming
    .filter((r: any) => r && r.id && r.text)
    .map((r: any) => ({
      id: String(r.id).slice(0, 240),
      title: String(r.title || 'Untitled').slice(0, 500),
      text: String(r.text).slice(0, 30000),
      source_class: r.source_class === 'historical_evidence' ? 'historical_evidence' : 'durable',
      canonical_status: String(r.canonical_status || (r.source_class === 'historical_evidence' ? 'noncanonical' : 'indexed')).slice(0, 100),
      updated_at: r.updated_at || null,
      volatile: Boolean(r.volatile),
      metadata: r.metadata && typeof r.metadata === 'object' ? r.metadata : {},
    }));

  const store = getStore(STORE, { consistency: 'strong' });
  const existing: any = (await store.get(INDEX_KEY, { type: 'json' })) || { version: 1, records: [] };
  const mode = body?.mode === 'replace' ? 'replace' : 'merge';
  const records = mode === 'replace' ? safe : mergeRecords(existing.records, safe);
  const index = { version: Number(existing.version || 1) + 1, generated_at: new Date().toISOString(), records };
  await store.setJSON(INDEX_KEY, index);
  return reply({ ok: true, mode, received: incoming.length, accepted: safe.length, records: records.length, version: index.version });
};

export const config: Config = { path: '/admin/memory/import' };
