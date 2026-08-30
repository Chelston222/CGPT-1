import type { Config, Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { authorised, searchIndex } from '../../lib/memory.mjs';

const PROTOCOL_VERSION = '2026-07-28';
const STORE = 'omega-memory';
const INDEX_KEY = 'memory/index.json';

function json(value: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json',
      'MCP-Protocol-Version': PROTOCOL_VERSION,
      ...extraHeaders,
    },
  });
}

function tools() {
  const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  return [
    {
      name: 'search',
      description: 'Use this when you need to find durable OMEGA memory or historical chat evidence relevant to a task.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 25 } },
        required: ['query'], additionalProperties: false,
      },
      annotations: readOnly,
    },
    {
      name: 'fetch',
      description: 'Use this when you need the complete stored memory record for an exact search result id.',
      inputSchema: {
        type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false,
      },
      annotations: readOnly,
    },
    {
      name: 'health',
      description: 'Use this when you need to verify whether the OMEGA memory service is seeded and healthy.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: readOnly,
    },
  ];
}

async function loadIndex() {
  const store = getStore(STORE, { consistency: 'strong' });
  return (await store.get(INDEX_KEY, { type: 'json' })) || { version: 1, records: [] };
}

function toolResult(value: unknown) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value) }],
    structuredContent: value,
    isError: false,
  };
}

async function callTool(name: string, args: Record<string, unknown>) {
  const index: any = await loadIndex();
  if (name === 'search') {
    const results = searchIndex(index, String(args.query || ''), Number(args.limit || 8)).map((record: any) => ({
      ...record,
      verification_required: record.source_class === 'historical_evidence' || record.volatile === true,
    }));
    return toolResult({ results, memory_order: ['durable', 'historical_evidence'], live_verification_rule: 'Verify volatile operational facts at the live source before consequential action.' });
  }
  if (name === 'fetch') {
    const record = (index.records || []).find((item: any) => String(item.id) === String(args.id || ''));
    return record ? toolResult(record) : { content: [{ type: 'text', text: 'Memory record not found' }], isError: true };
  }
  if (name === 'health') {
    return toolResult({ ok: true, seeded: Boolean(index.records?.length), records: index.records?.length || 0, version: index.version || 1, generated_at: index.generated_at || null });
  }
  return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
}

export default async (req: Request, context: Context) => {
  const token = Netlify.env.get('OMEGA_MCP_TOKEN');
  if (!token) return json({ error: 'OMEGA_MCP_TOKEN is not configured; service is fail-closed.' }, 503);
  if (!authorised(req, token)) return json({ error: 'unauthorised' }, 401);
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const id = body?.id ?? null;
  const method = body?.method || req.headers.get('Mcp-Method');
  const params = body?.params || {};

  if (method === 'server/discover') {
    return json({ jsonrpc: '2.0', id, result: { protocolVersion: PROTOCOL_VERSION, serverInfo: { name: 'omega-memory', version: '1.0.0' }, capabilities: { tools: {} } } });
  }
  if (method === 'tools/list') {
    return json({ jsonrpc: '2.0', id, result: { tools: tools(), ttlMs: 300000, cacheScope: 'server' } });
  }
  if (method === 'tools/call') {
    const result = await callTool(String(params.name || req.headers.get('Mcp-Name') || ''), params.arguments || {});
    return json({ jsonrpc: '2.0', id, result });
  }
  return json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } }, 404);
};

export const config: Config = { path: '/mcp' };
