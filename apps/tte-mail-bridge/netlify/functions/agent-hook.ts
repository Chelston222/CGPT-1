import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import nodemailer from "nodemailer";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const REQUIRED_OPT_OUT = "If you'd rather I didn't follow up, just let me know.";
const HOOK_TOKEN_SHA256 = "2e8ce87c7d1e57606e0c634e8e0ba17c88252d3afe4570bfd7894accf5b0fa62";
const DISPATCH_TOKEN_SHA256 = "4a985ff35e497b384825768cdf87f06080a98642048caa8467220f0d0f37bbe1";
const DEFAULT_DIRECT_RAMP_CAP = 5;
const RECEIPT_TO = "tripletwochelston@gmail.com";
const HANDLER_VERSION = "2026-08-16-v4";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function hashMatches(value: string | null | undefined, expectedHex: string) {
  if (!value) return false;
  const actual = Buffer.from(createHash("sha256").update(value).digest("hex"));
  const expected = Buffer.from(expectedHex);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function tokenMatches(value: string | null) {
  return hashMatches(value, HOOK_TOKEN_SHA256);
}

function dispatchTokenMatches(value: string | null | undefined) {
  return hashMatches(value, DISPATCH_TOKEN_SHA256);
}

function signatureMatches(rawBody: string, signature: string | null) {
  const secret = Netlify.env.get("TTE_MAILOPOLY_WEBHOOK_SECRET");
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex");
  const actualHex = signature.slice("sha256=".length);
  const expected = Buffer.from(expectedHex);
  const actual = Buffer.from(actualHex);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function londonDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function findMessage(value: any, depth = 0): any {
  if (depth > 6 || value == null) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findMessage(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === "object") {
    for (const key of ["message", "body", "payload", "data", "event"]) {
      if (key in value) {
        const candidate = value[key];
        if (key === "message" && (typeof candidate === "string" || typeof candidate === "object")) return candidate;
        const found = findMessage(candidate, depth + 1);
        if (found) return found;
      }
    }
    for (const candidate of Object.values(value)) {
      const found = findMessage(candidate, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function parseAgentPayload(webhookPayload: any) {
  const raw = findMessage(webhookPayload);
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw !== "string") return null;
  try { return JSON.parse(raw); } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
    }
    return null;
  }
}

function makeTransporter() {
  const smtpPass = Netlify.env.get("TTE_SMTP_PASS");
  const smtpUser = Netlify.env.get("TTE_SMTP_USER") || "hello@222emails.com";
  const smtpHost = Netlify.env.get("TTE_SMTP_HOST") || "mail.privateemail.com";
  const smtpPort = Number(Netlify.env.get("TTE_SMTP_PORT") || "465");
  if (!smtpPass) return null;
  return {
    smtpUser,
    transporter: nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
      requireTLS: smtpPort !== 465,
    }),
  };
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed", version: HANDLER_VERSION });

  const rawBody = await req.text();
  let webhookPayload: any;
  try { webhookPayload = JSON.parse(rawBody); }
  catch { return json(400, { error: "invalid_webhook_json", version: HANDLER_VERSION }); }

  const payload = parseAgentPayload(webhookPayload);
  const url = new URL(req.url);
  const authorised =
    tokenMatches(url.searchParams.get("k")) ||
    signatureMatches(rawBody, req.headers.get("x-mailopoly-signature")) ||
    dispatchTokenMatches(payload?.dispatchAuth);

  if (!authorised) return json(401, { error: "unauthorised", version: HANDLER_VERSION });

  const transport = makeTransporter();
  if (!transport) return json(503, { error: "smtp_secret_missing", version: HANDLER_VERSION });
  const { smtpUser, transporter } = transport;
  const directRampCap = Number(Netlify.env.get("TTE_GITHUB_DIRECT_RAMP_CAP") || DEFAULT_DIRECT_RAMP_CAP);

  if (!payload || typeof payload !== "object") {
    return json(400, { error: "missing_agent_message", version: HANDLER_VERSION, topLevelKeys: Object.keys(webhookPayload || {}) });
  }

  const { to, subject, text, idempotencyKey, leadId, touchNo } = payload;
  const recipients = Array.isArray(to) ? to : [to];
  if (recipients.length !== 1 || typeof recipients[0] !== "string" || !recipients[0].includes("@")) return json(400, { error: "exactly_one_recipient_required", version: HANDLER_VERSION });
  if (!subject || typeof subject !== "string" || subject.length > 180) return json(400, { error: "invalid_subject", version: HANDLER_VERSION });
  if (!text || typeof text !== "string" || text.length > 12000) return json(400, { error: "invalid_body", version: HANDLER_VERSION });
  if (!text.includes(REQUIRED_OPT_OUT)) return json(400, { error: "mandatory_opt_out_missing", version: HANDLER_VERSION });
  if (!idempotencyKey || typeof idempotencyKey !== "string" || !leadId || !touchNo) return json(400, { error: "idempotency_metadata_required", version: HANDLER_VERSION });
  if (idempotencyKey !== `${leadId}|${touchNo}`) return json(400, { error: "idempotency_key_mismatch", version: HANDLER_VERSION });

  const store = getStore({ name: "tte-mail-bridge", consistency: "strong" });
  const idempotencyBlob = `agent-idempotency/${idempotencyKey}`;
  const prior = await store.get(idempotencyBlob, { type: "json" });
  if (prior) return json(409, { error: "duplicate_blocked", prior, version: HANDLER_VERSION });

  const dateKey = londonDateKey();
  const counterKey = `agent-daily/${dateKey}`;
  const counter = (await store.get(counterKey, { type: "json" })) as { sent?: number } | null;
  const sentToday = Number(counter?.sent || 0);
  if (sentToday >= directRampCap) return json(429, { error: "direct_sender_ramp_reached", sentToday, directRampCap, version: HANDLER_VERSION });

  await store.setJSON(idempotencyBlob, {
    state: "IN_FLIGHT", idempotencyKey, leadId, touchNo, recipient: recipients[0], reservedAt: new Date().toISOString(), version: HANDLER_VERSION,
  });

  try {
    const info = await transporter.sendMail({
      from: `Chelston Phillip <${smtpUser}>`,
      to: recipients,
      subject,
      text,
      replyTo: smtpUser,
      headers: {
        "X-TTE-Lead-ID": String(leadId),
        "X-TTE-Touch-No": String(touchNo),
        "X-TTE-Idempotency-Key": String(idempotencyKey),
        "X-TTE-Route": "mailopoly-agent-netlify-privateemail",
      },
    });

    const result = {
      state: "SENT_CONFIRMED", route: "MAILOPOLY_AGENT_NETLIFY_PRIVATEEMAIL", idempotencyKey, leadId, touchNo,
      sender: smtpUser, recipient: recipients[0], messageId: info.messageId, accepted: info.accepted, rejected: info.rejected,
      sentAt: new Date().toISOString(), version: HANDLER_VERSION,
    };

    await store.setJSON(idempotencyBlob, result);
    await store.setJSON(counterKey, { sent: sentToday + 1, updatedAt: result.sentAt });

    let receiptSent = false;
    try {
      await transporter.sendMail({
        from: `TTE Direct SMTP Receipt <${smtpUser}>`,
        to: [RECEIPT_TO],
        subject: `TTE DIRECT RECEIPT ${idempotencyKey}`,
        text: [
          "Internal TTE direct SMTP execution receipt.", `State: ${result.state}`, `Route: ${result.route}`, `Lead: ${leadId}`,
          `Touch: ${touchNo}`, `Recipient: ${recipients[0]}`, `Provider message ID: ${info.messageId}`, `Sent at: ${result.sentAt}`,
          `Direct sender ramp: ${sentToday + 1}/${directRampCap}`, `Handler: ${HANDLER_VERSION}`,
        ].join("\n"),
      });
      receiptSent = true;
    } catch {}

    return json(200, { ...result, receiptSent, directRampCap });
  } catch (error: any) {
    const failed = {
      state: "SEND_FAILED", route: "MAILOPOLY_AGENT_NETLIFY_PRIVATEEMAIL", idempotencyKey, leadId, touchNo, recipient: recipients[0],
      failedAt: new Date().toISOString(), code: error?.code || null, responseCode: error?.responseCode || null,
      message: error?.message || "SMTP send failed", version: HANDLER_VERSION,
    };
    await store.setJSON(idempotencyBlob, failed);
    return json(502, failed);
  }
};

export const config: Config = {
  path: "/api/tte/agent-hook",
  method: ["POST"],
};
