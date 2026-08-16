import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import nodemailer from "nodemailer";
import { createHash, timingSafeEqual } from "node:crypto";

const REQUIRED_OPT_OUT = "If you'd rather I didn't follow up, just let me know.";
const HOOK_TOKEN_SHA256 = "2e8ce87c7d1e57606e0c634e8e0ba17c88252d3afe4570bfd7894accf5b0fa62";
const DEFAULT_DIRECT_RAMP_CAP = 5;
const RECEIPT_TO = "tripletwochelston@gmail.com";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function tokenMatches(value: string | null) {
  if (!value) return false;
  const actual = Buffer.from(createHash("sha256").update(value).digest("hex"));
  const expected = Buffer.from(HOOK_TOKEN_SHA256);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
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

function extractMessage(payload: any) {
  return payload?.message ?? payload?.body ?? payload?.event?.message ?? payload?.data?.message ?? null;
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const url = new URL(req.url);
  if (!tokenMatches(url.searchParams.get("k"))) {
    return json(401, { error: "unauthorised" });
  }

  const smtpPass = Netlify.env.get("TTE_SMTP_PASS");
  const smtpUser = Netlify.env.get("TTE_SMTP_USER") || "hello@222emails.com";
  const smtpHost = Netlify.env.get("TTE_SMTP_HOST") || "mail.privateemail.com";
  const smtpPort = Number(Netlify.env.get("TTE_SMTP_PORT") || "465");
  const directRampCap = Number(Netlify.env.get("TTE_GITHUB_DIRECT_RAMP_CAP") || DEFAULT_DIRECT_RAMP_CAP);
  if (!smtpPass) return json(503, { error: "smtp_secret_missing" });

  let webhookPayload: any;
  try {
    webhookPayload = await req.json();
  } catch {
    return json(400, { error: "invalid_webhook_json" });
  }

  const rawMessage = extractMessage(webhookPayload);
  let payload: any;
  try {
    payload = typeof rawMessage === "string" ? JSON.parse(rawMessage) : rawMessage;
  } catch {
    return json(400, { error: "invalid_agent_message_json" });
  }

  if (!payload || typeof payload !== "object") {
    return json(400, { error: "missing_agent_message" });
  }

  const { to, subject, text, idempotencyKey, leadId, touchNo } = payload;
  const recipients = Array.isArray(to) ? to : [to];
  if (recipients.length !== 1 || typeof recipients[0] !== "string" || !recipients[0].includes("@")) {
    return json(400, { error: "exactly_one_recipient_required" });
  }
  if (!subject || typeof subject !== "string" || subject.length > 180) {
    return json(400, { error: "invalid_subject" });
  }
  if (!text || typeof text !== "string" || text.length > 12000) {
    return json(400, { error: "invalid_body" });
  }
  if (!text.includes(REQUIRED_OPT_OUT)) {
    return json(400, { error: "mandatory_opt_out_missing" });
  }
  if (!idempotencyKey || typeof idempotencyKey !== "string" || !leadId || !touchNo) {
    return json(400, { error: "idempotency_metadata_required" });
  }
  if (idempotencyKey !== `${leadId}|${touchNo}`) {
    return json(400, { error: "idempotency_key_mismatch" });
  }

  const store = getStore({ name: "tte-mail-bridge", consistency: "strong" });
  const idempotencyBlob = `agent-idempotency/${idempotencyKey}`;
  const prior = await store.get(idempotencyBlob, { type: "json" });
  if (prior) return json(409, { error: "duplicate_blocked", prior });

  const dateKey = londonDateKey();
  const counterKey = `agent-daily/${dateKey}`;
  const counter = (await store.get(counterKey, { type: "json" })) as { sent?: number } | null;
  const sentToday = Number(counter?.sent || 0);
  if (sentToday >= directRampCap) {
    return json(429, { error: "direct_sender_ramp_reached", sentToday, directRampCap });
  }

  await store.setJSON(idempotencyBlob, {
    state: "IN_FLIGHT",
    idempotencyKey,
    leadId,
    touchNo,
    recipient: recipients[0],
    reservedAt: new Date().toISOString(),
  });

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
    requireTLS: smtpPort !== 465,
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
      state: "SENT_CONFIRMED",
      route: "MAILOPOLY_AGENT_NETLIFY_PRIVATEEMAIL",
      idempotencyKey,
      leadId,
      touchNo,
      sender: smtpUser,
      recipient: recipients[0],
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      sentAt: new Date().toISOString(),
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
          "Internal TTE direct SMTP execution receipt.",
          `State: ${result.state}`,
          `Route: ${result.route}`,
          `Lead: ${leadId}`,
          `Touch: ${touchNo}`,
          `Recipient: ${recipients[0]}`,
          `Provider message ID: ${info.messageId}`,
          `Sent at: ${result.sentAt}`,
          `Direct sender ramp: ${sentToday + 1}/${directRampCap}`,
        ].join("\n"),
      });
      receiptSent = true;
    } catch {
      receiptSent = false;
    }

    return json(200, { ...result, receiptSent, directRampCap });
  } catch (error: any) {
    const failed = {
      state: "SEND_FAILED",
      route: "MAILOPOLY_AGENT_NETLIFY_PRIVATEEMAIL",
      idempotencyKey,
      leadId,
      touchNo,
      recipient: recipients[0],
      failedAt: new Date().toISOString(),
      code: error?.code || null,
      responseCode: error?.responseCode || null,
      message: error?.message || "SMTP send failed",
    };
    await store.setJSON(idempotencyBlob, failed);
    return json(502, failed);
  }
};

export const config: Config = {
  path: "/api/tte/agent-hook",
  method: ["POST"],
};
