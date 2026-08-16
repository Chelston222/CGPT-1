import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import { createHash, timingSafeEqual } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const USER = process.env.TTE_SMTP_USER || 'hello@222emails.com';
const PASS = process.env.TTE_SMTP_PASS;
const SMTP_HOST = process.env.TTE_SMTP_HOST || 'mail.privateemail.com';
const SMTP_PORT = Number(process.env.TTE_SMTP_PORT || '465');
const IMAP_HOST = process.env.TTE_IMAP_HOST || 'mail.privateemail.com';
const IMAP_PORT = Number(process.env.TTE_IMAP_PORT || '993');
const CONTROL_SENDERS = new Set(['tripletwochelston@gmail.com', 'tripletwoemails@mly.life']);
const INTERNAL_RECEIPT = 'tripletwochelston@gmail.com';
const PREFIXES = ['TTE DIRECT JOB', 'TTE DIRECT BATCH'];
const REQUIRED_OPT_OUT = "If you'd rather I didn't follow up, just let me know.";
const DISPATCH_TOKEN_SHA256 = '4a985ff35e497b384825768cdf87f06080a98642048caa8467220f0d0f37bbe1';
const MAX_JOBS_PER_CONTROL = 5;
const LOOKBACK_MS = 36 * 60 * 60 * 1000;
const DEFAULT_RAMP_CAP = 5;
const DEFAULT_HARD_CAP = 20;
const VERSION = '2026-08-16-github-direct-v1';
const REPO_ROOT = resolve(process.cwd(), '../..');
const LEDGER_RELATIVE = 'apps/tte-mail-bridge/state/direct-ledger.json';
const LEDGER_PATH = resolve(REPO_ROOT, LEDGER_RELATIVE);

if (!PASS) throw new Error('TTE_SMTP_PASS is missing');

function londonMinutesNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value || '00';
  return Number(get('hour')) * 60 + Number(get('minute'));
}

function londonDateKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function inColdWindow() {
  const m = londonMinutesNow();
  return m >= 480 && m <= 570;
}

function dispatchAuthValid(value) {
  if (typeof value !== 'string' || !value) return false;
  const actual = Buffer.from(createHash('sha256').update(value).digest('hex'));
  const expected = Buffer.from(DISPATCH_TOKEN_SHA256);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
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
    if (control.jobs.length > MAX_JOBS_PER_CONTROL) return [];
    return control.jobs.map((job) => ({
      ...job,
      dispatchAuth: job?.dispatchAuth || control.dispatchAuth,
    }));
  }
  return [{ ...control }];
}

function loadLedger() {
  if (!existsSync(LEDGER_PATH)) {
    return { version: 1, updatedAt: null, idempotency: {}, daily: {} };
  }
  try {
    const parsed = JSON.parse(readFileSync(LEDGER_PATH, 'utf8'));
    return {
      version: 1,
      updatedAt: parsed.updatedAt || null,
      idempotency: parsed.idempotency && typeof parsed.idempotency === 'object' ? parsed.idempotency : {},
      daily: parsed.daily && typeof parsed.daily === 'object' ? parsed.daily : {},
    };
  } catch (error) {
    throw new Error(`Direct ledger is unreadable: ${error?.message || error}`);
  }
}

const ledger = loadLedger();

function persistLedger(reason) {
  mkdirSync(dirname(LEDGER_PATH), { recursive: true });
  ledger.updatedAt = new Date().toISOString();
  writeFileSync(LEDGER_PATH, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');

  execFileSync('git', ['add', '--', LEDGER_RELATIVE], { cwd: REPO_ROOT, stdio: 'inherit' });
  const changed = execFileSync('git', ['status', '--porcelain', '--', LEDGER_RELATIVE], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  if (!changed) return;

  const safeReason = String(reason || 'state update').replace(/[\r\n]+/g, ' ').slice(0, 120);
  execFileSync('git', ['commit', '-m', `TTE direct ledger: ${safeReason}`], { cwd: REPO_ROOT, stdio: 'inherit' });
  execFileSync('git', ['push', 'origin', 'HEAD:main'], { cwd: REPO_ROOT, stdio: 'inherit' });
}

function validateJob(job) {
  if (!job || typeof job !== 'object' || !dispatchAuthValid(job.dispatchAuth)) return 'unauthorised_control';

  const recipients = Array.isArray(job.to) ? job.to : [job.to];
  if (recipients.length !== 1 || typeof recipients[0] !== 'string' || !recipients[0].includes('@')) return 'exactly_one_recipient_required';
  if (!job.subject || typeof job.subject !== 'string' || job.subject.length > 180) return 'invalid_subject';
  if (!job.text || typeof job.text !== 'string' || job.text.length > 12000) return 'invalid_body';
  if (!job.text.includes(REQUIRED_OPT_OUT)) return 'mandatory_opt_out_missing';
  if (!job.idempotencyKey || typeof job.idempotencyKey !== 'string' || !job.leadId || !job.touchNo) return 'idempotency_metadata_required';
  if (job.idempotencyKey !== `${job.leadId}|${job.touchNo}`) return 'idempotency_key_mismatch';
  return null;
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: { user: USER, pass: PASS },
  requireTLS: SMTP_PORT !== 465,
});

async function sendReceipt(result, sentToday, rampCap) {
  try {
    await transporter.sendMail({
      from: `TTE Direct SMTP Receipt <${USER}>`,
      to: [INTERNAL_RECEIPT],
      subject: `TTE DIRECT RECEIPT ${result.idempotencyKey}`,
      text: [
        'Internal TTE direct SMTP execution receipt.',
        `State: ${result.state}`,
        `Route: ${result.route}`,
        `Lead: ${result.leadId}`,
        `Touch: ${result.touchNo}`,
        `Recipient: ${result.recipient}`,
        `Provider message ID: ${result.messageId}`,
        `Sent at: ${result.sentAt}`,
        `Direct cold ramp: ${sentToday}/${rampCap}`,
        `Handler: ${VERSION}`,
      ].join('\n'),
    });
  } catch (error) {
    console.warn(`TTE queue: receipt send failed: ${error?.message || error}`);
  }
}

async function executeJob(job, location) {
  const validationError = validateJob(job);
  if (validationError) {
    console.error(`TTE queue ${location} blocked=${validationError}`);
    return { status: 'BLOCKED_PREFLIGHT' };
  }

  const recipient = (Array.isArray(job.to) ? job.to[0] : job.to).trim().toLowerCase();
  const isInternal = recipient === INTERNAL_RECEIPT && String(job.leadId).startsWith('INTERNAL-');
  if (!isInternal && !inColdWindow()) return { status: 'HELD_WINDOW' };

  const prior = ledger.idempotency[job.idempotencyKey];
  if (prior?.state === 'SENT_CONFIRMED') return { status: 'DUPLICATE_CONFIRMED', body: prior };
  if (prior?.state) {
    console.warn(`TTE queue ${location} held idempotency=${job.idempotencyKey} prior=${prior.state}`);
    return { status: 'HELD_IDEMPOTENCY', body: prior };
  }

  const dateKey = londonDateKey();
  const configuredRamp = Number(process.env.TTE_DIRECT_RAMP_CAP || DEFAULT_RAMP_CAP);
  const hardCap = Number(process.env.TTE_DIRECT_DAILY_CAP || DEFAULT_HARD_CAP);
  const rampCap = Math.max(0, Math.min(configuredRamp, hardCap));
  const sentToday = Number(ledger.daily[dateKey]?.sent || 0);
  if (!isInternal && sentToday >= rampCap) return { status: 'HELD_CAP' };

  ledger.idempotency[job.idempotencyKey] = {
    state: 'IN_FLIGHT',
    idempotencyKey: job.idempotencyKey,
    leadId: job.leadId,
    touchNo: job.touchNo,
    recipient,
    reservedAt: new Date().toISOString(),
    route: 'MAILOPOLY_CONTROL_IMAP_GITHUB_PRIVATEEMAIL',
    version: VERSION,
  };

  try {
    persistLedger(`reserve ${job.idempotencyKey}`);
  } catch (error) {
    console.error(`TTE queue ${location} reservation persistence failed; send aborted: ${error?.message || error}`);
    return { status: 'HELD_LEDGER' };
  }

  let info;
  try {
    info = await transporter.sendMail({
      from: `Chelston Phillip <${USER}>`,
      to: [recipient],
      subject: job.subject,
      text: job.text,
      replyTo: USER,
      headers: {
        'X-TTE-Lead-ID': String(job.leadId),
        'X-TTE-Touch-No': String(job.touchNo),
        'X-TTE-Idempotency-Key': String(job.idempotencyKey),
        'X-TTE-Route': 'mailopoly-control-imap-github-privateemail',
      },
    });
  } catch (error) {
    ledger.idempotency[job.idempotencyKey] = {
      ...ledger.idempotency[job.idempotencyKey],
      state: 'DELIVERY_PENDING',
      failedAt: new Date().toISOString(),
      code: error?.code || null,
      responseCode: Number(error?.responseCode || 0) || null,
      message: error?.message || 'SMTP send failed',
    };
    try { persistLedger(`hold ${job.idempotencyKey}`); } catch {}
    console.error(`TTE queue ${location} SMTP ambiguous/failure; fail-closed idempotency=${job.idempotencyKey}: ${error?.message || error}`);
    return { status: 'DELIVERY_PENDING' };
  }

  const accepted = Array.isArray(info.accepted) ? info.accepted.map((x) => String(x).toLowerCase()) : [];
  const rejected = Array.isArray(info.rejected) ? info.rejected.map((x) => String(x).toLowerCase()) : [];
  if (!accepted.includes(recipient) || rejected.includes(recipient)) {
    ledger.idempotency[job.idempotencyKey] = {
      ...ledger.idempotency[job.idempotencyKey],
      state: 'DELIVERY_PENDING',
      messageId: info.messageId || null,
      accepted,
      rejected,
      failedAt: new Date().toISOString(),
    };
    try { persistLedger(`hold ${job.idempotencyKey}`); } catch {}
    return { status: 'DELIVERY_PENDING' };
  }

  const sentAt = new Date().toISOString();
  const result = {
    state: 'SENT_CONFIRMED',
    route: 'MAILOPOLY_CONTROL_IMAP_GITHUB_PRIVATEEMAIL',
    idempotencyKey: job.idempotencyKey,
    leadId: job.leadId,
    touchNo: job.touchNo,
    sender: USER,
    recipient,
    messageId: info.messageId,
    accepted,
    rejected,
    sentAt,
    version: VERSION,
  };

  ledger.idempotency[job.idempotencyKey] = result;
  let resultingDaily = sentToday;
  if (!isInternal) {
    resultingDaily = sentToday + 1;
    ledger.daily[dateKey] = { sent: resultingDaily, updatedAt: sentAt, rampCap };
  }

  try {
    persistLedger(`confirm ${job.idempotencyKey}`);
  } catch (error) {
    console.error(`TTE queue ${location} SMTP accepted but final ledger push failed. Fail closed on next run. idempotency=${job.idempotencyKey}: ${error?.message || error}`);
    return { status: 'DELIVERY_PENDING', body: result };
  }

  await sendReceipt(result, resultingDaily, rampCap);
  console.log(`TTE queue ${location} state=SENT_CONFIRMED idempotency=${job.idempotencyKey} messageId=${info.messageId}`);
  return { status: 'SENT_CONFIRMED', body: result };
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
  await transporter.verify();
  console.log(`TTE queue SMTP verified sender=${USER} version=${VERSION}`);

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
      if (!jobs.length) {
        console.error(`TTE queue: malformed or oversized control ${location}`);
        blocked += 1;
        continue;
      }

      for (const job of jobs) {
        const result = await executeJob(job, location);
        switch (result.status) {
          case 'SENT_CONFIRMED': confirmed += 1; break;
          case 'DUPLICATE_CONFIRMED': duplicates += 1; break;
          case 'BLOCKED_PREFLIGHT': blocked += 1; break;
          case 'DELIVERY_PENDING':
          case 'HELD_CAP':
          case 'HELD_WINDOW':
          case 'HELD_IDEMPOTENCY':
          case 'HELD_LEDGER': held += 1; stopAll = true; break;
          default: held += 1; stopAll = true;
        }
        if (stopAll) break;
      }
      if (stopAll) break;
    }
  }
} finally {
  try { await client.logout(); } catch {}
  try { transporter.close(); } catch {}
}

console.log(`TTE queue summary folders=${scannedFolders} candidates=${candidates} confirmed=${confirmed} duplicates=${duplicates} blocked=${blocked} held=${held}`);
