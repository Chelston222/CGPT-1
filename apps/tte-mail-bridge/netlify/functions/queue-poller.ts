import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { createHash, timingSafeEqual } from "node:crypto";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";

const REQUIRED_OPT_OUT = "If you'd rather I didn't follow up, just let me know.";
const DISPATCH_TOKEN_SHA256 = "4a985ff35e497b384825768cdf87f06080a98642048caa8467220f0d0f37bbe1";
const CONTROL_SENDER = "tripletwochelston@gmail.com";
const RECEIPT_TO = CONTROL_SENDER;
const QUEUE_SUBJECT_PREFIX = "TTE DIRECT JOB";
const DEFAULT_DIRECT_RAMP_CAP = 5;
const DEFAULT_HARD_CAP = 20;
const HANDLER_VERSION = "2026-08-16-queue-v1";

type Job = {
  dispatchAuth?: string;
  to?: string | string[];
  subject?: string;
  text?: string;
  idempotencyKey?: string;
  leadId?: string;
  touchNo?: number | string;
};

function hashMatches(value: string | null | undefined, expectedHex: string) {
  if (!value) return false;
  const actual = Buffer.from(createHash("sha256").update(value).digest("hex"));
  const expected = Buffer.from(expectedHex);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function londonParts() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
  return {
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

function insideColdWindow() {
  const { hour, minute } = londonParts();
  const total = hour * 60 + minute;
  return total >= 8 * 60 && total <= 9 * 60 + 30;
}

function parseJob(text: string): Job | null {
  const trimmed = text.trim();
  try { return JSON.parse(trimmed); } catch {}
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(trimmed.slice(start, end + 1)); } catch {}
  }
  return null;
}

function normalizeRecipient(to: Job["to"]) {
  const recipients = Array.isArray(to) ? to : [to];
  if (recipients.length !== 1 || typeof recipients[0] !== "string" || !recipients[0].includes("@")) return null;
  return recipients[0].trim().toLowerCase();
}

async function sendReceipt(transporter: any, smtpUser: string, subject: string, lines: string[]) {
  try {
    await transporter.sendMail({
      from: `TTE Direct SMTP Receipt <${smtpUser}>`,
      to: [RECEIPT_TO],
      subject,
      text: lines.join("\n"),
    });
  } catch {}
}

export default async () => {
  const smtpPass = Netlify.env.get("TTE_SMTP_PASS");
  const smtpUser = Netlify.env.get("TTE_SMTP_USER") || "hello@222emails.com";
  const smtpHost = Netlify.env.get("TTE_SMTP_HOST") || "mail.privateemail.com";
  const smtpPort = Number(Netlify.env.get("TTE_SMTP_PORT") || "465");
  const imapHost = Netlify.env.get("TTE_IMAP_HOST") || "mail.privateemail.com";
  const imapPort = Number(Netlify.env.get("TTE_IMAP_PORT") || "993");
  const rampCap = Number(Netlify.env.get("TTE_DIRECT_RAMP_CAP") || DEFAULT_DIRECT_RAMP_CAP);
  const hardCap = Number(Netlify.env.get("TTE_DIRECT_DAILY_CAP") || DEFAULT_HARD_CAP);
  const effectiveCap = Math.max(0, Math.min(rampCap, hardCap));

  if (!smtpPass) {
    console.error("TTE queue poller: SMTP/IMAP secret missing");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
    requireTLS: smtpPort !== 465,
  });

  const client = new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
    logger: false,
  });

  const store = getStore({ name: "tte-mail-bridge", consistency: "strong" });
  const { dateKey } = londonParts();
  const counterKey = `queue-daily/${dateKey}`;
  const counter = (await store.get(counterKey, { type: "json" })) as { sent?: number } | null;
  let sentToday = Number(counter?.sent || 0);

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const unseenUids = await client.search({ seen: false }, { uid: true });
      const candidateUids = unseenUids.slice(-25);
      if (!candidateUids.length) return;

      const messages = await client.fetchAll(candidateUids, {
        uid: true,
        envelope: true,
        source: true,
      }, { uid: true });

      for (const message of messages) {
        const fromAddress = message.envelope?.from?.[0]?.address?.toLowerCase() || "";
        const envelopeSubject = message.envelope?.subject || "";
        if (fromAddress !== CONTROL_SENDER || !envelopeSubject.startsWith(QUEUE_SUBJECT_PREFIX)) continue;

        const parsed = await simpleParser(message.source as Buffer, {
          skipHtmlToText: false,
          skipTextToHtml: true,
          maxHtmlLengthToParse: 100_000,
        });
        const job = parseJob(parsed.text || "");
        if (!job || !hashMatches(job.dispatchAuth, DISPATCH_TOKEN_SHA256)) {
          await client.messageFlagsAdd(message.uid, ["\\Seen"], { uid: true });
          await sendReceipt(transporter, smtpUser, "TTE DIRECT QUEUE BLOCKED AUTH", [
            "A TTE direct queue message was blocked because its dispatch authentication was invalid.",
            `Queue UID: ${message.uid}`,
            `Handler: ${HANDLER_VERSION}`,
          ]);
          continue;
        }

        const recipient = normalizeRecipient(job.to);
        const leadId = String(job.leadId || "");
        const touchNo = String(job.touchNo || "");
        const idempotencyKey = String(job.idempotencyKey || "");
        const isInternalTest = recipient === RECEIPT_TO && leadId.startsWith("INTERNAL-");

        if (!isInternalTest && !insideColdWindow()) {
          continue;
        }

        if (!recipient || !job.subject || typeof job.subject !== "string" || job.subject.length > 180 ||
            !job.text || typeof job.text !== "string" || job.text.length > 12000 ||
            !job.text.includes(REQUIRED_OPT_OUT) || !leadId || !touchNo || idempotencyKey !== `${leadId}|${touchNo}`) {
          await client.messageFlagsAdd(message.uid, ["\\Seen"], { uid: true });
          await sendReceipt(transporter, smtpUser, `TTE DIRECT QUEUE BLOCKED ${idempotencyKey || "INVALID"}`, [
            "A TTE direct queue message failed structural preflight and was not sent.",
            `Lead: ${leadId || "missing"}`,
            `Touch: ${touchNo || "missing"}`,
            `Queue UID: ${message.uid}`,
            `Handler: ${HANDLER_VERSION}`,
          ]);
          continue;
        }

        const idempotencyBlob = `queue-idempotency/${idempotencyKey}`;
        const prior = await store.get(idempotencyBlob, { type: "json" });
        if (prior) {
          await client.messageFlagsAdd(message.uid, ["\\Seen"], { uid: true });
          await sendReceipt(transporter, smtpUser, `TTE DIRECT DUPLICATE BLOCKED ${idempotencyKey}`, [
            "Duplicate direct queue job blocked.",
            `Lead: ${leadId}`,
            `Touch: ${touchNo}`,
            `Handler: ${HANDLER_VERSION}`,
          ]);
          continue;
        }

        if (!isInternalTest && sentToday >= effectiveCap) {
          break;
        }

        await store.setJSON(idempotencyBlob, {
          state: "IN_FLIGHT",
          idempotencyKey,
          leadId,
          touchNo,
          recipient,
          queueUid: message.uid,
          reservedAt: new Date().toISOString(),
          version: HANDLER_VERSION,
        });

        try {
          const info = await transporter.sendMail({
            from: `Chelston Phillip <${smtpUser}>`,
            to: [recipient],
            subject: job.subject,
            text: job.text,
            replyTo: smtpUser,
            headers: {
              "X-TTE-Lead-ID": leadId,
              "X-TTE-Touch-No": touchNo,
              "X-TTE-Idempotency-Key": idempotencyKey,
              "X-TTE-Route": "gmail-control-imap-netlify-privateemail",
            },
          });

          const result = {
            state: "SENT_CONFIRMED",
            route: "GMAIL_CONTROL_IMAP_NETLIFY_PRIVATEEMAIL",
            idempotencyKey,
            leadId,
            touchNo,
            sender: smtpUser,
            recipient,
            messageId: info.messageId,
            accepted: info.accepted,
            rejected: info.rejected,
            sentAt: new Date().toISOString(),
            version: HANDLER_VERSION,
          };

          await store.setJSON(idempotencyBlob, result);
          if (!isInternalTest) {
            sentToday += 1;
            await store.setJSON(counterKey, { sent: sentToday, updatedAt: result.sentAt, effectiveCap });
          }
          await client.messageFlagsAdd(message.uid, ["\\Seen"], { uid: true });
          await sendReceipt(transporter, smtpUser, `TTE DIRECT RECEIPT ${idempotencyKey}`, [
            "Internal TTE direct SMTP execution receipt.",
            `State: ${result.state}`,
            `Route: ${result.route}`,
            `Lead: ${leadId}`,
            `Touch: ${touchNo}`,
            `Recipient: ${recipient}`,
            `Provider message ID: ${info.messageId}`,
            `Sent at: ${result.sentAt}`,
            `Direct cold ramp: ${sentToday}/${effectiveCap}`,
            `Handler: ${HANDLER_VERSION}`,
          ]);
        } catch (error: any) {
          const responseCode = Number(error?.responseCode || 0);
          const temporary = responseCode >= 400 && responseCode < 500;
          const failed = {
            state: temporary ? "DELIVERY_PENDING" : "SEND_FAILED",
            route: "GMAIL_CONTROL_IMAP_NETLIFY_PRIVATEEMAIL",
            idempotencyKey,
            leadId,
            touchNo,
            recipient,
            failedAt: new Date().toISOString(),
            code: error?.code || null,
            responseCode: responseCode || null,
            message: error?.message || "SMTP send failed",
            version: HANDLER_VERSION,
          };
          await store.setJSON(idempotencyBlob, failed);
          await client.messageFlagsAdd(message.uid, ["\\Seen"], { uid: true });
          await sendReceipt(transporter, smtpUser, `TTE DIRECT ${failed.state} ${idempotencyKey}`, [
            `State: ${failed.state}`,
            `Lead: ${leadId}`,
            `Touch: ${touchNo}`,
            `Recipient: ${recipient}`,
            `SMTP response code: ${failed.responseCode || "none"}`,
            `Handler: ${HANDLER_VERSION}`,
          ]);
          if (!isInternalTest) break;
        }
      }
    } finally {
      lock.release();
    }
  } catch (error) {
    console.error("TTE queue poller error", error);
  } finally {
    try { await client.logout(); } catch {}
  }
};

export const config: Config = {
  schedule: "* * * * *",
};
