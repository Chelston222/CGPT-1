import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

const USER = process.env.TTE_SMTP_USER || 'hello@222emails.com';
const PASS = process.env.TTE_SMTP_PASS;
const IMAP_HOST = process.env.TTE_IMAP_HOST || 'mail.privateemail.com';
const IMAP_PORT = Number(process.env.TTE_IMAP_PORT || '993');
const CONTROL_SENDERS = new Set(['tripletwochelston@gmail.com', 'tripletwoemails@mly.life']);
const INTERNAL_RECEIPT = 'tripletwochelston@gmail.com';
const PREFIXES = ['TTE DIRECT JOB', 'TTE DIRECT BATCH'];
const ENDPOINT = 'https://222emails-mail-bridge.netlify.app/.netlify/functions/direct-dispatch';
const MAX_JOBS_PER_CONTROL = 5;
const LOOKBACK_MS = 36 * 60 * 60 * 1000;

if (!PASS) throw new Error('TTE_SMTP_PASS is missing');

function londonNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value || '00';
  return Number(get('hour')) * 60 + Number(get('minute'));
}

function inColdWindow() {
  const m = londonNow();
  return m >= 480 && m <= 570;
}

function parseControl(text) {
  const v = (text || '').trim();
  try { return JSON.parse(v); } catch {}
  const a = v.indexOf('{');
  const b = v.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { return JSON.parse(v.slice(a, b + 1)); } catch {}
  }
  return null;
}

function expandJobs(control) {
  if (!control || typeof control !== 'object') return [];
  if (Array.isArray(control.jobs)) {
    return control.jobs.slice(0, MAX_JOBS_PER_CONTROL).map((job) => ({
      ...job,
      dispatchAuth: job?.dispatchAuth || control.dispatchAuth,
    }));
  }
  return [{ ...control }];
}

async function executeJob(job, location) {
  const recipient = Array.isArray(job.to) ? job.to[0] : job.to;
  const isInternal = recipient === INTERNAL_RECEIPT && String(job.leadId || '').startsWith('INTERNAL-');
  if (!isInternal && !inColdWindow()) return { status: 'HELD_WINDOW' };

  let response;
  let responseText = '';
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: job }),
      signal: AbortSignal.timeout(20000),
    });
    responseText = await response.text();
  } catch (error) {
    console.error(`TTE queue: endpoint transport failure ${location}: ${error?.message || error}`);
    return { status: 'HELD_TRANSPORT' };
  }

  let body = {};
  try { body = JSON.parse(responseText); } catch {}
  const state = body?.state || body?.prior?.state || body?.error || 'unknown';
  console.log(`TTE queue ${location} http=${response.status} state=${state} idempotency=${job.idempotencyKey || 'missing'}`);

  if (response.ok) return { status: 'SENT_CONFIRMED', body };
  if (response.status === 409 && body?.prior?.state === 'SENT_CONFIRMED') return { status: 'DUPLICATE_CONFIRMED', body };
  if (response.status === 409) return { status: 'BLOCKED_DUPLICATE_NONFINAL', body };
  if ([400, 401, 405].includes(response.status)) return { status: 'BLOCKED_PREFLIGHT', body };
  if (response.status === 429) return { status: 'HELD_CAP', body };
  if (response.status === 502 && body?.state === 'DELIVERY_PENDING') return { status: 'DELIVERY_PENDING', body };
  if (response.status === 502 && body?.state === 'SEND_FAILED') return { status: 'SEND_FAILED', body };
  return { status: 'HELD_UNKNOWN', body };
}

const client = new ImapFlow({
  host: IMAP_HOST,
  port: IMAP_PORT,
  secure: true,
  auth: { user: USER, pass: PASS },
  logger: false,
});

let confirmed = 0;
let duplicates = 0;
let blocked = 0;
let held = 0;
let candidates = 0;
let scannedFolders = 0;
let stopAll = false;

try {
  await client.connect();
  const mailboxes = await client.list();
  const selectable = mailboxes.filter((mb) => !mb.flags?.has('\\Noselect'));
  console.log(`TTE queue mailboxes=${selectable.map((m) => `${m.path}${m.specialUse ? `(${m.specialUse})` : ''}`).join(',')}`);

  for (const mailbox of selectable) {
    if (stopAll) break;
    const special = String(mailbox.specialUse || '').toLowerCase();
    if (['\\sent', '\\drafts', '\\trash'].includes(special)) continue;

    await client.mailboxOpen(mailbox.path, { readOnly: true });
    scannedFolders += 1;
    const since = new Date(Date.now() - LOOKBACK_MS);
    const recent = await client.search({ since }, { uid: true });
    const uids = recent.slice(-100);
    if (!uids.length) continue;

    const messages = await client.fetchAll(uids, { uid: true, envelope: true, source: true }, { uid: true });
    for (const message of messages) {
      const from = message.envelope?.from?.[0]?.address?.toLowerCase() || '';
      const subject = message.envelope?.subject || '';
      if (!CONTROL_SENDERS.has(from) || !PREFIXES.some((prefix) => subject.startsWith(prefix))) continue;
      candidates += 1;
      const location = `folder=${mailbox.path} uid=${message.uid}`;

      const parsed = await simpleParser(message.source, { skipTextToHtml: true, maxHtmlLengthToParse: 150000 });
      const control = parseControl(parsed.text || '');
      const jobs = expandJobs(control);
      if (!jobs.length || (Array.isArray(control?.jobs) && control.jobs.length > MAX_JOBS_PER_CONTROL)) {
        console.error(`TTE queue: malformed or oversized control ${location}`);
        blocked += 1;
        continue;
      }

      for (const job of jobs) {
        const result = await executeJob(job, location);
        switch (result.status) {
          case 'SENT_CONFIRMED': confirmed += 1; break;
          case 'DUPLICATE_CONFIRMED': duplicates += 1; break;
          case 'BLOCKED_PREFLIGHT':
          case 'BLOCKED_DUPLICATE_NONFINAL':
          case 'SEND_FAILED': blocked += 1; stopAll = true; break;
          case 'DELIVERY_PENDING': held += 1; stopAll = true; break;
          case 'HELD_CAP':
          case 'HELD_WINDOW':
          case 'HELD_TRANSPORT':
          case 'HELD_UNKNOWN': held += 1; stopAll = true; break;
          default: held += 1; stopAll = true;
        }
        if (stopAll) break;
      }
      if (stopAll) break;
    }
  }
} finally {
  try { await client.logout(); } catch {}
}

console.log(`TTE queue summary folders=${scannedFolders} candidates=${candidates} confirmed=${confirmed} duplicates=${duplicates} blocked=${blocked} held=${held}`);
