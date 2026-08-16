import { createHash, randomUUID } from 'node:crypto';

export function nowIso(now = new Date()) { return now.toISOString(); }
export function sha256(value) { return createHash('sha256').update(String(value)).digest('hex'); }
export function shortHash(value, n = 24) { return sha256(value).slice(0, n); }
export function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
export function maskEmail(email) {
  const value = normalizeEmail(email);
  const [local, domain] = value.split('@');
  if (!local || !domain) return 'invalid';
  return `${local.slice(0, 2)}${local.length > 2 ? '***' : '*'}@${domain}`;
}
export function recipientDomain(email) { return normalizeEmail(email).split('@')[1] || ''; }
export function londonDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function londonClockMinutes(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone:'Europe/London', hourCycle:'h23', hour:'2-digit', minute:'2-digit' }).formatToParts(now);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  return get('hour') * 60 + get('minute');
}
export function withinLondonSendingWindow(now = new Date(), startHour = 8, endHour = 18) {
  const minute = londonClockMinutes(now);
  const start = Math.max(0, Math.min(24 * 60, Math.round(Number(startHour) * 60)));
  const end = Math.max(0, Math.min(24 * 60, Math.round(Number(endHour) * 60)));
  if (start === end) return false;
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}
export function daysBetween(startIso, now = new Date()) {
  if (!startIso) return 0;
  const diff = now.getTime() - new Date(startIso).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}
export function isFuture(iso, now = new Date()) { return Boolean(iso && new Date(iso).getTime() > now.getTime()); }
export function minutesSince(iso, now = new Date()) {
  if (!iso) return Infinity;
  return Math.max(0, (now.getTime() - new Date(iso).getTime()) / 60000);
}
export function boundedNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
export function randomId(prefix = 'id') { return `${prefix}_${randomUUID()}`; }
export function safeText(value, max = 500) { return String(value || '').trim().slice(0, max); }
export function base64UrlEncode(input) { return Buffer.from(input).toString('base64url'); }
export function base64UrlDecode(input) { return Buffer.from(String(input), 'base64url').toString('utf8'); }
export function jsonResponse(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extraHeaders } });
}
export function parseJsonSafely(text) { try { return JSON.parse(text); } catch { return null; } }
export function deterministicNoise(seed) { return Number.parseInt(sha256(seed).slice(0, 8), 16) / 0xffffffff; }
