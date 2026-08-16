import { randomUUID } from 'node:crypto';
import { DEFAULTS } from './constants.mjs';
import { decryptJsonAny, encryptJson } from './crypto.mjs';
import { decryptionKeys, encryptionKey } from './auth.mjs';
import { deliverApproved } from './engine.mjs';
import { acquireDispatchLease, audit, findQueueItem, getQueueDedupe, listQueue, releaseDispatchLease, saveQueueItem, setQueueDedupe } from './store.mjs';
import { nowIso, shortHash, withinLondonSendingWindow } from './util.mjs';
import { validateOutbound } from './validation.mjs';

function isApproved(payload) { return String(payload.reviewState || '').toUpperCase() === 'APPROVED' && Boolean(payload.reviewedBy); }
function decryptQueuePayload(item) { return decryptJsonAny(item.payloadCipher, decryptionKeys(), `queue:${item.id}`); }

export async function enqueueOutbound(input) {
  const check = validateOutbound(input, { requireFirstTouchReview:false, requireSequenceApproval:false });
  if (!check.ok) return { ok:false, status:400, error:'validation_failed', errors:check.errors };
  if (await getQueueDedupe(check.normalized.idempotencyKey)) return { ok:false, status:409, error:'duplicate_queue_item' };
  const existing = await listQueue(['PENDING_REVIEW','READY','IN_FLIGHT']);
  if (existing.length >= Number(Netlify.env.get('TTE_QUEUE_MAX_SIZE') || DEFAULTS.queueMaxSize)) return { ok:false, status:429, error:'queue_capacity_reached' };
  const state = isApproved(check.normalized) || (Number(check.normalized.touchNo) > 1 && check.normalized.sequenceApproved === true) ? 'READY' : 'PENDING_REVIEW';
  const id = `q_${shortHash(check.normalized.idempotencyKey, 32)}`; const dueAt = check.normalized.dueAt ? new Date(check.normalized.dueAt).toISOString() : nowIso();
  const payloadCipher = encryptJson(check.normalized, encryptionKey(), `queue:${id}`);
  const item = await saveQueueItem({ id, state, dueAt, createdAt:nowIso(), leadHash:shortHash(check.normalized.leadId,48), touchNo:Number(check.normalized.touchNo), idempotencyHash:shortHash(check.normalized.idempotencyKey,48), recipientHash:shortHash(check.normalized.to[0],48), campaignName:String(check.normalized.campaignName || '').slice(0,120), payloadCipher });
  await setQueueDedupe(check.normalized.idempotencyKey, { queueId:id, state, createdAt:nowIso() });
  await audit('QUEUE_CREATED', { queueId:id, state, leadHash:item.leadHash, touchNo:item.touchNo });
  return { ok:true, status:202, queueId:id, state, dueAt };
}
export async function queueView(states = []) {
  const items = await listQueue(states);
  return items.slice(0, 200).map((item) => {
    let payload = null;
    try { payload = decryptQueuePayload(item); } catch {}
    return { id:item.id, state:item.state, dueAt:item.dueAt, createdAt:item.createdAt, updatedAt:item.updatedAt, campaignName:item.campaignName, touchNo:item.touchNo, leadId:payload?.leadId || null, to:payload?.to?.[0] || null, subject:payload?.subject || null, text:payload?.text || null, compliance:payload?.compliance || null, reviewedBy:payload?.reviewedBy || null, lastResult:item.lastResult || null, payloadReadable:Boolean(payload) };
  });
}
export async function queueAction({ id, action, actor }) {
  const item = await findQueueItem(id); if (!item) return { ok:false, status:404, error:'queue_item_not_found' };
  if (['SENT','CANCELLED','DELIVERY_UNKNOWN'].includes(item.state)) return { ok:false, status:409, error:'terminal_queue_state', state:item.state };
  if (action === 'cancel') {
    const updated = await saveQueueItem({ ...item, state:'CANCELLED', cancelledAt:nowIso(), cancelledBy:actor });
    await audit('QUEUE_CANCELLED', { queueId:id, actor }); return { ok:true, status:200, state:updated.state };
  }
  if (action === 'approve') {
    let payload;
    try { payload = decryptQueuePayload(item); }
    catch {
      const blocked = await saveQueueItem({ ...item, state:'BLOCKED', lastResult:{ code:'PAYLOAD_DECRYPT_FAILED' } });
      await audit('QUEUE_PAYLOAD_DECRYPT_FAILED', { queueId:id, actor });
      return { ok:false, status:409, error:'payload_decrypt_failed', state:blocked.state };
    }
    payload.reviewState = 'APPROVED'; payload.reviewedBy = actor; payload.reviewedAt = nowIso();
    const check = validateOutbound(payload);
    if (!check.ok) return { ok:false, status:400, error:'approval_validation_failed', errors:check.errors };
    const updated = await saveQueueItem({ ...item, state:'READY', payloadCipher:encryptJson(check.normalized,encryptionKey(),`queue:${item.id}`), approvedAt:nowIso(), approvedBy:actor });
    await audit('QUEUE_APPROVED', { queueId:id, actor }); return { ok:true, status:200, state:updated.state };
  }
  return { ok:false, status:400, error:'unsupported_action' };
}
export async function recoverStaleInFlight() {
  const staleMinutes = Number(Netlify.env.get('TTE_STALE_IN_FLIGHT_MINUTES') || DEFAULTS.staleInFlightMinutes);
  const items = await listQueue(['IN_FLIGHT']); let recovered = 0;
  for (const item of items) {
    const age = Date.now() - new Date(item.updatedAt || item.dueAt).getTime();
    if (age > staleMinutes * 60000) {
      await saveQueueItem({ ...item, state:'DELIVERY_UNKNOWN', lastResult:{ code:'STALE_IN_FLIGHT_REQUIRES_MANUAL_REVIEW' } });
      await audit('STALE_IN_FLIGHT_QUARANTINED', { queueId:item.id }); recovered++;
    }
  }
  return recovered;
}
export async function dispatchReady({ max = DEFAULTS.queueBatchSize, trigger = 'manual' } = {}) {
  const now = new Date();
  if (Netlify.env.get('TTE_SEND_WINDOW_ENABLED') !== 'false') {
    const start = Number(Netlify.env.get('TTE_SEND_START_HOUR') || 8);
    const end = Number(Netlify.env.get('TTE_SEND_END_HOUR') || 18);
    if (!withinLondonSendingWindow(now, start, end)) return { ok:true, trigger, skipped:'outside_london_sending_window', attempted:0, results:[] };
  }
  const leaseOwner = `${trigger}:${randomUUID()}`;
  const lease = await acquireDispatchLease(leaseOwner);
  if (!lease.acquired) return { ok:true, trigger, skipped:'dispatcher_busy', attempted:0, results:[] };
  try {
    const recovered = await recoverStaleInFlight();
    const ready = (await listQueue(['READY']))
      .filter((x) => new Date(x.dueAt).getTime() <= Date.now())
      .sort((a,b) => (Number(b.touchNo > 1) - Number(a.touchNo > 1)) || (new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()))
      .slice(0, Math.max(1, Math.min(20, Number(max) || DEFAULTS.queueBatchSize)));
    const results = [];
    for (const item of ready) {
      let payload;
      try { payload = decryptQueuePayload(item); }
      catch {
        const blocked = await saveQueueItem({ ...item, state:'BLOCKED', lastResult:{ code:'PAYLOAD_DECRYPT_FAILED' } });
        await audit('QUEUE_PAYLOAD_DECRYPT_FAILED', { queueId:item.id, trigger });
        results.push({ queueId:item.id, state:blocked.state, code:'PAYLOAD_DECRYPT_FAILED' });
        continue;
      }
      const finalCheck = validateOutbound(payload);
      if (!finalCheck.ok) {
        const blocked = await saveQueueItem({ ...item, state:'BLOCKED', lastResult:{ code:'FINAL_VALIDATION_FAILED', errors:finalCheck.errors } });
        results.push({ queueId:item.id, state:blocked.state, code:'FINAL_VALIDATION_FAILED' }); continue;
      }
      let working = await saveQueueItem({ ...item, state:'IN_FLIGHT', inFlightAt:nowIso() });
      const result = await deliverApproved(finalCheck.normalized, { queueId:item.id, trigger });
      if (result.ok) working = await saveQueueItem({ ...working, state:'SENT', sentAt:result.sentAt, lastResult:result });
      else if (result.state === 'DELIVERY_UNKNOWN') working = await saveQueueItem({ ...working, state:'DELIVERY_UNKNOWN', lastResult:result });
      else if (result.retryable) working = await saveQueueItem({ ...working, state:'READY', dueAt:new Date(Date.now() + Number(result.retryAfterMinutes || 15)*60000).toISOString(), lastResult:result });
      else working = await saveQueueItem({ ...working, state:'BLOCKED', lastResult:result });
      results.push({ queueId:item.id, state:working.state, code:result.code || null, sender:result.sender || null });
    }
    return { ok:true, trigger, recoveredStale:recovered, attempted:ready.length, results };
  } finally { await releaseDispatchLease(leaseOwner); }
}
