import { getStore } from '@netlify/blobs';

const STORE_NAME = 'linkedin-review-decisions';
const MAX_DECISIONS_PER_REQUEST = 120;
const SAFE_ID = /^[a-zA-Z0-9._:-]{1,160}$/;
const ALLOWED_DECISIONS = new Set(['approve', 'reject']);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function authorised(req) {
  const configured = Netlify.env.get('REVIEW_SYNC_TOKEN');
  if (!configured) return { ok: false, reason: 'Decision sync is not configured.' };
  const supplied = req.headers.get('x-review-sync-key') || '';
  if (supplied !== configured) return { ok: false, reason: 'The review sync key was not recognised.' };
  return { ok: true, reason: '' };
}

function cleanText(value, max = 800) {
  return String(value || '').trim().slice(0, max);
}

function keyPrefix(ledgerId) {
  const deployContext = Netlify.context?.deploy?.context || 'production';
  return `${deployContext}/${ledgerId}/`;
}

function decisionKey(ledgerId, postId) {
  return `${keyPrefix(ledgerId)}${postId}`;
}

function validateLedgerId(value) {
  const ledgerId = cleanText(value, 160);
  if (!SAFE_ID.test(ledgerId)) throw new Error('Invalid ledger ID.');
  return ledgerId;
}

function validatePostId(value) {
  const postId = cleanText(value, 160);
  if (!SAFE_ID.test(postId)) throw new Error('Invalid post ID.');
  return postId;
}

function validateUpdate(value) {
  const postId = validatePostId(value?.postId);
  const revision = Number(value?.revision);
  if (!Number.isInteger(revision) || revision < 1 || revision > 100000) throw new Error(`Invalid revision for ${postId}.`);
  const decision = cleanText(value?.decision, 20);
  if (!ALLOWED_DECISIONS.has(decision)) throw new Error(`Invalid decision for ${postId}.`);
  const clientAt = cleanText(value?.at, 80);
  const parsedAt = Date.parse(clientAt);
  if (!Number.isFinite(parsedAt)) throw new Error(`Invalid decision timestamp for ${postId}.`);
  return {
    postId,
    revision,
    decision,
    note: decision === 'reject' ? cleanText(value?.note, 800) : '',
    at: new Date(parsedAt).toISOString(),
  };
}

export default async (req) => {
  const auth = authorised(req);
  if (!auth.ok) return json({ error: auth.reason }, auth.reason.includes('configured') ? 503 : 401);

  const url = new URL(req.url);
  let ledgerId;
  try {
    ledgerId = validateLedgerId(url.searchParams.get('ledgerId'));
  } catch (error) {
    return json({ error: error.message }, 400);
  }

  const store = getStore(STORE_NAME, { consistency: 'strong' });

  if (req.method === 'GET') {
    const { blobs } = await store.list({ prefix: keyPrefix(ledgerId) });
    if (blobs.length > 500) return json({ error: 'Decision store exceeded the safe review limit.' }, 409);
    const decisions = {};
    await Promise.all(blobs.map(async ({ key }) => {
      const saved = await store.get(key, { type: 'json' });
      if (saved?.postId) decisions[saved.postId] = saved;
    }));
    return json({ ledgerId, decisions });
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Request body must be JSON.' }, 400);
  }

  const rawUpdates = Array.isArray(body?.updates) ? body.updates : [];
  const rawDeletes = Array.isArray(body?.deletes) ? body.deletes : [];
  if (rawUpdates.length + rawDeletes.length > MAX_DECISIONS_PER_REQUEST) {
    return json({ error: 'Too many decision changes in one request.' }, 413);
  }

  let updates;
  let deletes;
  try {
    updates = rawUpdates.map(validateUpdate);
    deletes = [...new Set(rawDeletes.map(validatePostId))];
  } catch (error) {
    return json({ error: error.message }, 400);
  }

  const receivedAt = new Date().toISOString();
  const applied = [];
  const ignoredAsStale = [];

  for (const update of updates) {
    const key = decisionKey(ledgerId, update.postId);
    const existing = await store.get(key, { type: 'json' });
    const existingAt = existing?.at ? Date.parse(existing.at) : Number.NEGATIVE_INFINITY;
    const incomingAt = Date.parse(update.at);
    if (Number.isFinite(existingAt) && incomingAt < existingAt) {
      ignoredAsStale.push(update.postId);
      continue;
    }
    await store.setJSON(key, { ...update, receivedAt });
    applied.push(update.postId);
  }

  for (const postId of deletes) {
    await store.delete(decisionKey(ledgerId, postId));
    applied.push(postId);
  }

  return json({ ok: true, ledgerId, applied: [...new Set(applied)], ignoredAsStale });
};

export const config = {
  path: '/api/review-decisions',
};
