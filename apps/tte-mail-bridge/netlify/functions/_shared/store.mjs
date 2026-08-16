import { getDeployStore, getStore } from '@netlify/blobs';
import { STORE_NAME } from './constants.mjs';
import { londonDateKey, maskEmail, nowIso, recipientDomain, shortHash } from './util.mjs';

export function store() {
  const options = { name: STORE_NAME, consistency: 'strong' };
  const context = Netlify.context?.deploy?.context || Netlify.env.get('CONTEXT') || '';
  return context === 'production' ? getStore(options) : getDeployStore(options);
}
const json = async (key) => store().get(key, { type: 'json' });

export async function listAccounts() {
  const { blobs } = await store().list({ prefix: 'accounts/' });
  return Promise.all(blobs.map(async ({ key }) => ({ ...(await json(key)), _key: key })));
}
export async function getAccount(id) { return json(`accounts/${id}`); }
export async function saveAccount(account) {
  await store().setJSON(`accounts/${account.id}`, { ...account, updatedAt: nowIso() });
  return account;
}
export async function deleteAccount(id) { await store().delete(`accounts/${id}`); }

export async function getSuppression(email) { return json(`suppressions/${shortHash(String(email).toLowerCase(), 48)}`); }
export async function addSuppression(email, reason = 'operator', source = 'system') {
  const key = `suppressions/${shortHash(String(email).toLowerCase(), 48)}`;
  const item = { emailHash: key.split('/')[1], maskedEmail: maskEmail(email), reason, source, createdAt: nowIso() };
  await store().setJSON(key, item);
  return item;
}
export async function removeSuppression(email) { await store().delete(`suppressions/${shortHash(String(email).toLowerCase(), 48)}`); }
export async function listSuppressions() {
  const { blobs } = await store().list({ prefix: 'suppressions/' });
  return Promise.all(blobs.slice(0, 500).map(({ key }) => json(key)));
}

export async function getEmergencyStop() { return (await json('control/emergency-stop')) || { stopped: false }; }
export async function setEmergencyStop(stopped, reason, actor) {
  const value = { stopped: Boolean(stopped), reason: String(reason || ''), actor: String(actor || ''), updatedAt: nowIso() };
  await store().setJSON('control/emergency-stop', value); return value;
}

export async function getIdempotency(key) { return json(`idempotency/${shortHash(key, 48)}`); }
export async function setIdempotency(key, value) { await store().setJSON(`idempotency/${shortHash(key, 48)}`, value); }
export async function getQueueDedupe(key) { return json(`queue-idempotency/${shortHash(key, 48)}`); }
export async function setQueueDedupe(key, value) { await store().setJSON(`queue-idempotency/${shortHash(key, 48)}`, value); }

function dueKey(item) { return `queue/${item.state}/${item.id}`; }

export async function saveQueueItem(item) {
  const next = { ...item, updatedAt: nowIso() };
  const key = dueKey(next);
  const persisted = { ...next }; delete persisted._key;
  // Write the new state before removing the old key. If interrupted, global idempotency
  // safely contains the temporary duplicate; deleting first could permanently lose work.
  await store().setJSON(key, persisted);
  if (item._key && item._key !== key) await store().delete(item._key);
  return { ...persisted, _key: key };
}
export async function findQueueItem(id) {
  const { blobs } = await store().list({ prefix: 'queue/' });
  const hit = blobs.find(({ key }) => key.endsWith(`/${id}`));
  return hit ? { ...(await json(hit.key)), _key: hit.key } : null;
}
export async function listQueue(states = []) {
  const prefixes = states.length ? states.map((s) => `queue/${s}/`) : ['queue/'];
  const results = [];
  for (const prefix of prefixes) {
    const { blobs } = await store().list({ prefix });
    for (const { key } of blobs) results.push({ ...(await json(key)), _key: key });
  }
  return results.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}

export async function getLeadRoute(leadHash) { return json(`lead-route/${leadHash}`); }
export async function setLeadRoute(leadHash, route) { await store().setJSON(`lead-route/${leadHash}`, { ...route, updatedAt: nowIso() }); }
export async function getReplyMarker(leadHash) { return json(`reply/${leadHash}`); }
export async function setReplyMarker(leadHash, marker) { await store().setJSON(`reply/${leadHash}`, { ...marker, updatedAt: nowIso() }); }

export async function getUsage(account, _recipientEmail, now = new Date()) {
  const date = londonDateKey(now);
  const prev = londonDateKey(new Date(now.getTime() - 86400000));
  const accountId = account.id;
  const { blobs: today } = await store().list({ prefix: `sent/account/${accountId}/${date}/` });
  const { blobs: yesterday } = await store().list({ prefix: `sent/account/${accountId}/${prev}/` });
  const cutoff = now.getTime() - 86400000;
  const rolling = [...today, ...yesterday].filter(({ key }) => Number(key.split('/').at(-1)?.split('-')[0]) >= cutoff);
  const state = await json(`usage/account/${accountId}`) || {};
  return { sentToday: today.length, sentRolling24h: rolling.length, lastSentAt: state.lastSentAt || null, consecutiveFailures: Number(state.consecutiveFailures || 0) };
}
export async function domainSentToday(recipientEmail, now = new Date()) {
  const date = londonDateKey(now);
  const domainHash = shortHash(recipientDomain(recipientEmail), 32);
  const { blobs } = await store().list({ prefix: `sent/domain/${date}/${domainHash}/` });
  return blobs.length;
}
export async function globalSentToday(now = new Date()) {
  const { blobs } = await store().list({ prefix: `sent/global/${londonDateKey(now)}/` });
  return blobs.length;
}
export async function recordSent({ accountId, recipientEmail, messageRef, at = new Date() }) {
  const date = londonDateKey(at); const epoch = at.getTime(); const suffix = `${epoch}-${shortHash(messageRef || Math.random(), 16)}`;
  const domainHash = shortHash(recipientDomain(recipientEmail), 32);
  const s = store();
  await Promise.all([
    s.setJSON(`sent/account/${accountId}/${date}/${suffix}`, { at: at.toISOString(), messageRef: String(messageRef || '') }),
    s.setJSON(`sent/global/${date}/${suffix}-${accountId}`, { at: at.toISOString(), accountId }),
    s.setJSON(`sent/domain/${date}/${domainHash}/${suffix}`, { at: at.toISOString(), accountId }),
    s.setJSON(`usage/account/${accountId}`, { lastSentAt: at.toISOString(), consecutiveFailures: 0 }),
  ]);
}
export async function recordFailure(accountId, details = {}) {
  const key = `usage/account/${accountId}`; const prior = await json(key) || {};
  await store().setJSON(key, { ...prior, lastFailureAt: nowIso(), consecutiveFailures: Number(prior.consecutiveFailures || 0) + 1, lastFailureCode: details.code || null });
}
export async function resetFailureState(accountId) {
  const key = `usage/account/${accountId}`; const prior = await json(key) || {};
  await store().setJSON(key, { ...prior, consecutiveFailures: 0, lastFailureCode: null, recoveredAt: nowIso() });
}
export async function audit(event, fields = {}) {
  const now = new Date(); const key = `audit/${londonDateKey(now)}/${now.getTime()}-${shortHash(`${event}|${Math.random()}`, 12)}`;
  await store().setJSON(key, { event, at: now.toISOString(), ...fields });
}
export async function auditRecent(limit = 100) {
  const date = londonDateKey(); const prev = londonDateKey(new Date(Date.now() - 86400000));
  const all = [];
  for (const d of [date, prev]) {
    const { blobs } = await store().list({ prefix: `audit/${d}/` });
    all.push(...blobs);
  }
  all.sort((a,b) => b.key.localeCompare(a.key));
  return Promise.all(all.slice(0, limit).map(({ key }) => json(key)));
}

export async function acquireDispatchLease(owner, ttlMs = 55000) {
  const s = store(); const now = Date.now(); const leaseKey = 'control/dispatch-lease';
  const active = await s.get(leaseKey, { type: 'json' });
  if (active?.expiresAt && Number(active.expiresAt) > now && active.owner !== owner) return { acquired:false, holder:active.owner, expiresAt:active.expiresAt };
  const candidateKey = `dispatch-candidates/${now}-${owner}`;
  await s.setJSON(candidateKey, { owner, createdAt:now, expiresAt:now + 5000 });
  await new Promise((resolve) => setTimeout(resolve, 350));
  const current = await s.get(leaseKey, { type:'json' });
  if (current?.expiresAt && Number(current.expiresAt) > Date.now() && current.owner !== owner) { await s.delete(candidateKey); return { acquired:false, holder:current.owner, expiresAt:current.expiresAt }; }
  const { blobs } = await s.list({ prefix:'dispatch-candidates/' });
  const candidates = [];
  for (const { key } of blobs.slice(-50)) {
    const candidate = await s.get(key, { type:'json' });
    if (candidate?.expiresAt && Number(candidate.expiresAt) > Date.now()) candidates.push({ ...candidate, key });
    else await s.delete(key);
  }
  candidates.sort((a,b) => Number(a.createdAt)-Number(b.createdAt) || String(a.owner).localeCompare(String(b.owner)));
  if (!candidates.length || candidates[0].owner !== owner) { await s.delete(candidateKey); return { acquired:false, holder:candidates[0]?.owner || null }; }
  const lease = { owner, acquiredAt:nowIso(), expiresAt:Date.now()+ttlMs };
  await s.setJSON(leaseKey, lease);
  await new Promise((resolve) => setTimeout(resolve, 150));
  const verified = await s.get(leaseKey, { type:'json' });
  await s.delete(candidateKey);
  return verified?.owner === owner ? { acquired:true, ...lease } : { acquired:false, holder:verified?.owner || null };
}

export async function releaseDispatchLease(owner) {
  const s = store(); const key='control/dispatch-lease'; const active=await s.get(key,{type:'json'});
  if (active?.owner === owner) await s.delete(key);
}
