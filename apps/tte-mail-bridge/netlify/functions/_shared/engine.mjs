import nodemailer from 'nodemailer';
import { DEFAULTS } from './constants.mjs';
import { decryptJsonAny } from './crypto.mjs';
import { decryptionKeys, googleClientId, googleClientSecret } from './auth.mjs';
import { refreshAccessToken, sendGmail } from './google.mjs';
import { buildMime } from './mime.mjs';
import { selectSender } from './routing.mjs';
import {
  audit, domainSentToday, getAccount, getEmergencyStop, getIdempotency, getLeadRoute, getReplyMarker,
  getSuppression, getUsage, globalSentToday, listAccounts, recordFailure, recordSent, saveAccount,
  setIdempotency, setLeadRoute,
} from './store.mjs';
import { boundedNumber, nowIso, shortHash } from './util.mjs';

function configNumber(name, fallback, min = 0, max = 100000) {
  return boundedNumber(Netlify.env.get(name), fallback, min, max);
}
function virtualSmtpAccount() {
  const pass = Netlify.env.get('TTE_SMTP_PASS');
  if (!pass) return null;
  return {
    id: 'legacy-smtp', provider: 'smtp', email: Netlify.env.get('TTE_SMTP_USER') || 'hello@222emails.com',
    senderName: Netlify.env.get('TTE_SMTP_FROM_NAME') || 'Chelston Phillip', status: 'ACTIVE', enabled: true,
    dailyCap: configNumber('TTE_DIRECT_DAILY_CAP', DEFAULTS.legacySmtpDailyCap, 1, 100),
    rolling24hCap: configNumber('TTE_SMTP_ROLLING_24H_CAP', DEFAULTS.legacySmtpDailyCap, 1, 100),
    minIntervalMinutes: configNumber('TTE_SMTP_MIN_INTERVAL_MINUTES', 4, 0, 120),
    priority: configNumber('TTE_SMTP_PRIORITY', 12, -100, 100), health: { score: 100 },
  };
}
export async function routableAccounts() {
  const persisted = (await listAccounts()).map(({ _key, token, ...a }) => a);
  const smtp = virtualSmtpAccount();
  return smtp ? [smtp, ...persisted] : persisted;
}
async function accessFor(account) {
  if (account.provider !== 'gmail') return null;
  const full = await getAccount(account.id);
  if (!full?.token) throw Object.assign(new Error('gmail_token_record_missing'), { reauthRequired:true, code:'TOKEN_RECORD_MISSING' });
  let tokenData;
  try { tokenData = decryptJsonAny(full.token, decryptionKeys(), `gmail-token:${account.id}`); }
  catch (cause) { throw Object.assign(new Error('gmail_token_decrypt_failed'), { reauthRequired:true, code:'TOKEN_DECRYPT_FAILED', cause }); }
  return refreshAccessToken({ refreshToken: tokenData.refreshToken, clientId: googleClientId(), clientSecret: googleClientSecret() });
}
async function smtpSend({ account, to, subject, text, leadId, touchNo, idempotencyKey }) {
  const port = Number(Netlify.env.get('TTE_SMTP_PORT') || '465');
  const transporter = nodemailer.createTransport({
    host: Netlify.env.get('TTE_SMTP_HOST') || 'mail.privateemail.com', port, secure: port === 465,
    auth: { user: account.email, pass: Netlify.env.get('TTE_SMTP_PASS') }, requireTLS: port !== 465,
  });
  try {
    const info = await transporter.sendMail({
      from: `${account.senderName || 'Chelston Phillip'} <${account.email}>`, to, subject, text, replyTo: account.email,
      headers: { 'X-TTE-Lead-ID': String(leadId), 'X-TTE-Touch-No': String(touchNo), 'X-TTE-Idempotency-Key': String(idempotencyKey), 'List-Unsubscribe': `<mailto:${account.email}?subject=unsubscribe>` },
    });
    return { provider:'smtp', messageId:info.messageId, threadId:null, rfcMessageId:info.messageId, accepted:info.accepted, rejected:info.rejected };
  } catch (cause) {
    const explicitRejected = Number(cause?.responseCode || 0) >= 400 && Number(cause?.responseCode || 0) < 500;
    throw Object.assign(new Error(explicitRejected ? 'smtp_send_rejected' : 'smtp_delivery_unknown'), { deliveryUnknown: !explicitRejected, cause, code:cause?.code, responseCode:cause?.responseCode });
  }
}
async function gmailSend({ account, to, subject, text, leadId, touchNo, idempotencyKey, route }) {
  const accessToken = await accessFor(account);
  const { raw, messageId } = buildMime({ fromName:account.senderName || 'Chelston Phillip', fromEmail:account.email, to, subject, text, leadId, touchNo, idempotencyKey, inReplyTo:route?.rfcMessageId || null, references:route?.references || route?.rfcMessageId || null });
  const sent = await sendGmail({ accessToken, raw, threadId: route?.threadId || null });
  return { provider:'gmail', messageId:sent.id, threadId:sent.threadId || route?.threadId || null, rfcMessageId:messageId, references: route?.references ? `${route.references} ${messageId}` : messageId };
}
function failureDisposition(err) {
  if (err?.reauthRequired || err?.message === 'reauth_required' || err?.code === 'invalid_grant') return { state:'FAILED', code:err?.code === 'invalid_grant' ? 'REAUTH_REQUIRED' : (err?.code || 'REAUTH_REQUIRED'), reauth:true, cooldownMinutes:15, retryable:true, affectsHealth:false };
  if (err?.deliveryUnknown) return { state:'DELIVERY_UNKNOWN', code:'DELIVERY_UNKNOWN', quarantine:true, cooldownMinutes:60, retryable:false, affectsHealth:true };
  if (err?.safeRetry) return { state:'FAILED', code:err?.code || 'PRE_SEND_TEMPORARY_FAILURE', cooldownMinutes:15, retryable:true, affectsHealth:false };
  if (err?.status === 429 || ['rateLimitExceeded','userRateLimitExceeded'].includes(err?.reason)) return { state:'FAILED', code:'RATE_LIMITED', cooldownMinutes:60, retryable:true, affectsHealth:true };
  if (err?.status === 403 && /limit|quota|rate/i.test(JSON.stringify(err?.data || {}))) return { state:'FAILED', code:'PROVIDER_LIMIT', cooldownMinutes:1440, retryable:true, affectsHealth:true };
  if (err?.status === 401) return { state:'FAILED', code:'REAUTH_REQUIRED', reauth:true, cooldownMinutes:15, retryable:true, affectsHealth:false };
  return { state:'FAILED', code:err?.reason || err?.code || err?.message || 'SEND_FAILED', cooldownMinutes:60, retryable:false, affectsHealth:true };
}
async function recoverHealthAfterSuccess(account) {
  if (account.provider !== 'gmail') return;
  if (Number(account.health?.score ?? 100) >= 100 && !account.health?.lastFailureCode) return;
  const full = await getAccount(account.id);
  if (!full) return;
  full.health = { ...(full.health || {}), score:Math.min(100, Number(full.health?.score ?? 100) + 2), lastFailureCode:null, lastSuccessAt:nowIso() };
  await saveAccount(full);
}

export async function deliverApproved(payload, { queueId = null, trigger = 'api' } = {}) {
  const now = new Date();
  const to = payload.to[0]; const leadHash = shortHash(payload.leadId, 48);
  const emergency = await getEmergencyStop();
  if (emergency.stopped) return { ok:false, state:'BLOCKED', code:'EMERGENCY_STOP', retryable:false };
  if (await getSuppression(to)) return { ok:false, state:'BLOCKED', code:'SUPPRESSED', retryable:false };
  if (Number(payload.touchNo) > 1 && await getReplyMarker(leadHash)) return { ok:false, state:'BLOCKED', code:'REPLY_DETECTED', retryable:false };
  const prior = await getIdempotency(payload.idempotencyKey);
  if (prior) {
    if (prior.state === 'SENT') return { ok:true, duplicate:true, ...prior };
    if (prior.state === 'FAILED' && prior.retryable === true && (!prior.retryAfterAt || new Date(prior.retryAfterAt).getTime() <= Date.now())) {
      // Safe retry only when the previous outcome proves there was no ambiguous delivery.
    } else {
      return { ok:false, duplicate:true, ...prior };
    }
  }

  const globalCap = configNumber('TTE_GLOBAL_DAILY_CAP', DEFAULTS.globalDailyCap, 1, 1000);
  const globalToday = await globalSentToday(now);
  if (globalToday >= globalCap) return { ok:false, state:'BLOCKED', code:'GLOBAL_DAILY_CAP', retryable:true, retryAfterMinutes:60 };

  const accounts = await routableAccounts();
  const route = await getLeadRoute(leadHash);
  const usageByAccount = {};
  for (const account of accounts) usageByAccount[account.id] = await getUsage(account, to, now);
  const domainDailyCap = configNumber('TTE_DOMAIN_DAILY_CAP', DEFAULTS.domainDailyCap, 1, 100);
  if (await domainSentToday(to, now) >= domainDailyCap) return { ok:false, state:'BLOCKED', code:'RECIPIENT_DOMAIN_DAILY_CAP', retryable:true, retryAfterMinutes:720 };

  const continuityRequired = Number(payload.touchNo) > 1 && route?.accountId && payload.allowSenderSwitch !== true;
  const candidateAccounts = continuityRequired ? accounts.filter((a) => a.id === route.accountId) : accounts;
  if (continuityRequired && candidateAccounts.length === 0) return { ok:false, state:'BLOCKED', code:'CONTINUITY_SENDER_MISSING', retryable:false };
  const choice = selectSender({ accounts:candidateAccounts, usageByAccount, leadId:payload.leadId, continuityAccountId:route?.accountId || null, now });
  if (!choice.selected) return { ok:false, state:'BLOCKED', code:'NO_HEALTHY_SENDER', retryable:true, retryAfterMinutes:15, diagnostics:choice.diagnostics };
  const account = accounts.find((a) => a.id === choice.selected.accountId);

  const inFlight = { ok:false, state:'IN_FLIGHT', idempotencyKey:payload.idempotencyKey, queueId, leadHash, accountId:account.id, recipientHash:shortHash(to, 48), reservedAt:nowIso(), trigger };
  await setIdempotency(payload.idempotencyKey, inFlight);
  await audit('SEND_RESERVED', { queueId, leadHash, accountId:account.id, touchNo:Number(payload.touchNo), trigger });

  try {
    const sent = account.provider === 'gmail'
      ? await gmailSend({ account, to, subject:payload.subject, text:payload.text, leadId:payload.leadId, touchNo:payload.touchNo, idempotencyKey:payload.idempotencyKey, route: route?.accountId === account.id ? route : null })
      : await smtpSend({ account, to, subject:payload.subject, text:payload.text, leadId:payload.leadId, touchNo:payload.touchNo, idempotencyKey:payload.idempotencyKey });
    const result = { ok:true, state:'SENT', idempotencyKey:payload.idempotencyKey, queueId, leadHash, senderAccountId:account.id, sender:account.email, recipientHash:shortHash(to,48), touchNo:Number(payload.touchNo), sentAt:nowIso(), ...sent };
    await recordSent({ accountId:account.id, recipientEmail:to, messageRef:sent.messageId, at:new Date() });
    await recoverHealthAfterSuccess(account);
    await setLeadRoute(leadHash, { accountId:account.id, provider:account.provider, threadId:sent.threadId || route?.threadId || null, rfcMessageId:sent.rfcMessageId || route?.rfcMessageId || null, references:sent.references || route?.references || sent.rfcMessageId || null, lastTouchNo:Number(payload.touchNo) });
    await setIdempotency(payload.idempotencyKey, result);
    await audit('SEND_CONFIRMED', { queueId, leadHash, accountId:account.id, touchNo:Number(payload.touchNo), provider:account.provider, providerMessageId:sent.messageId });
    return result;
  } catch (err) {
    const disposition = failureDisposition(err);
    if (disposition.affectsHealth !== false) await recordFailure(account.id, { code:disposition.code });
    if (account.provider === 'gmail') {
      const full = await getAccount(account.id);
      if (full) {
        if (disposition.reauth) full.status = 'REAUTH_REQUIRED';
        if (disposition.quarantine) { full.status = 'QUARANTINED'; full.quarantinedUntil = new Date(Date.now() + 3600000).toISOString(); }
        else if (disposition.cooldownMinutes && !disposition.reauth) full.cooldownUntil = new Date(Date.now() + disposition.cooldownMinutes * 60000).toISOString();
        if (disposition.affectsHealth !== false) {
          full.health = { ...(full.health || {}), score:Math.max(0, Number(full.health?.score ?? 100) - (disposition.quarantine ? 35 : 10)), lastFailureCode:disposition.code, lastFailureAt:nowIso() };
        }
        await saveAccount(full);
      }
    }
    const retryAfterAt = disposition.retryable ? new Date(Date.now() + Number(disposition.cooldownMinutes || 15) * 60000).toISOString() : null;
    const failed = { ok:false, state:disposition.state, code:disposition.code, idempotencyKey:payload.idempotencyKey, queueId, leadHash, accountId:account.id, failedAt:nowIso(), retryable:Boolean(disposition.retryable), retryAfterAt, retryAfterMinutes:Number(disposition.cooldownMinutes || 15) };
    await setIdempotency(payload.idempotencyKey, failed);
    await audit(disposition.state === 'DELIVERY_UNKNOWN' ? 'DELIVERY_UNKNOWN' : 'SEND_FAILED', { queueId, leadHash, accountId:account.id, code:disposition.code, touchNo:Number(payload.touchNo) });
    return failed;
  }
}
