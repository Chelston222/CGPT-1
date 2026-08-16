import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

const USER = process.env.TTE_SMTP_USER || 'hello@222emails.com';
const PASS = process.env.TTE_SMTP_PASS;
const IMAP_HOST = process.env.TTE_IMAP_HOST || 'mail.privateemail.com';
const IMAP_PORT = Number(process.env.TTE_IMAP_PORT || '993');
const CONTROL_SENDER = 'tripletwochelston@gmail.com';
const PREFIX = 'TTE DIRECT JOB';
const ENDPOINT = 'https://222emails-mail-bridge.netlify.app/api/tte/agent-hook';

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

function parseJob(text) {
  const v = (text || '').trim();
  try { return JSON.parse(v); } catch {}
  const a = v.indexOf('{');
  const b = v.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { return JSON.parse(v.slice(a, b + 1)); } catch {}
  }
  return null;
}

const client = new ImapFlow({
  host: IMAP_HOST,
  port: IMAP_PORT,
  secure: true,
  auth: { user: USER, pass: PASS },
  logger: false,
});

let processed = 0;
let held = 0;
let blocked = 0;

try {
  await client.connect();
  const lock = await client.getMailboxLock('INBOX');
  try {
    const unseen = await client.search({ seen: false }, { uid: true });
    const uids = unseen.slice(-30);
    if (!uids.length) {
      console.log('TTE queue: no unseen messages');
      process.exitCode = 0;
    } else {
      const messages = await client.fetchAll(uids, { uid: true, envelope: true, source: true }, { uid: true });
      for (const message of messages) {
        const from = message.envelope?.from?.[0]?.address?.toLowerCase() || '';
        const subject = message.envelope?.subject || '';
        if (from !== CONTROL_SENDER || !subject.startsWith(PREFIX)) continue;

        const parsed = await simpleParser(message.source, { skipTextToHtml: true, maxHtmlLengthToParse: 100000 });
        const job = parseJob(parsed.text || '');
        if (!job) {
          console.error(`TTE queue: malformed job uid=${message.uid}`);
          await client.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true });
          blocked += 1;
          continue;
        }

        const recipient = Array.isArray(job.to) ? job.to[0] : job.to;
        const isInternal = recipient === CONTROL_SENDER && String(job.leadId || '').startsWith('INTERNAL-');
        if (!isInternal && !inColdWindow()) {
          held += 1;
          continue;
        }

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
          console.error(`TTE queue: endpoint transport failure uid=${message.uid}: ${error?.message || error}`);
          held += 1;
          continue;
        }

        let body = {};
        try { body = JSON.parse(responseText); } catch {}
        const state = body?.state || body?.prior?.state || body?.error || 'unknown';
        console.log(`TTE queue uid=${message.uid} http=${response.status} state=${state} idempotency=${job.idempotencyKey || 'missing'}`);

        if (response.ok || response.status === 409) {
          await client.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true });
          processed += 1;
          continue;
        }

        if ([400, 401, 405].includes(response.status)) {
          await client.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true });
          blocked += 1;
          continue;
        }

        if (response.status === 429) {
          held += 1;
          break;
        }

        if (response.status === 502 && ['SEND_FAILED', 'DELIVERY_PENDING'].includes(body?.state)) {
          await client.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true });
          blocked += 1;
          break;
        }

        held += 1;
        break;
      }
    }
  } finally {
    lock.release();
  }
} finally {
  try { await client.logout(); } catch {}
}

console.log(`TTE queue summary processed=${processed} blocked=${blocked} held=${held}`);
