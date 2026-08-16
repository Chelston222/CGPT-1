import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import nodemailer from "nodemailer";
import { createHash, timingSafeEqual } from "node:crypto";

const REQUIRED_OPT_OUT = "If you'd rather I didn't follow up, just let me know.";
const DISPATCH_TOKEN_SHA256 = "4a985ff35e497b384825768cdf87f06080a98642048caa8467220f0d0f37bbe1";
const DEFAULT_DIRECT_RAMP_CAP = 5;
const DEFAULT_HARD_CAP = 20;
const RECEIPT_TO = "tripletwochelston@gmail.com";
const VERSION = "2026-08-16-native-v1";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function dispatchAuthValid(value: unknown) {
  if (typeof value !== "string" || !value) return false;
  const actual = Buffer.from(createHash("sha256").update(value).digest("hex"));
  const expected = Buffer.from(DISPATCH_TOKEN_SHA256);
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

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed", version: VERSION });

  let wrapper: any;
  try { wrapper = await req.json(); }
  catch { return json(400, { error: "invalid_json", version: VERSION }); }

  const payload = wrapper?.message && typeof wrapper.message === "object" ? wrapper.message : wrapper;
  if (!payload || typeof payload !== "object" || !dispatchAuthValid(payload.dispatchAuth)) {
    return json(401, { error: "unauthorised", version: VERSION });
  }

  const smtpPass = Netlify.env.get("TTE_SMTP_PASS");
  const smtpUser = Netlify.env.get("TTE_SMTP_USER") || "hello@222emails.com";
  const smtpHost = Netlify.env.get("TTE_SMTP_HOST") || "mail.privateemail.com";
  const smtpPort = Number(Netlify.env.get("TTE_SMTP_PORT") || "465");
  const configuredRamp = Number(Netlify.env.get("TTE_DIRECT_RAMP_CAP") || DEFAULT_DIRECT_RAMP_CAP);
  const hardCap = Number(Netlify.env.get("TTE_DIRECT_DAILY_CAP") || DEFAULT_HARD_CAP);
  const directRampCap = Math.max(0, Math.min(configuredRamp, hardCap));
  if (!smtpPass) return json(503, { error: "smtp_secret_missing", version: VERSION });

  const { to, subject, text, idempotencyKey, leadId, touchNo } = payload;
  const recipients = Array.isArray(to) ? to : [to];
  if (recipients.length !== 1 || typeof recipients[0] !== "string" || !recipients[0].includes("@")) {
    return json(400, { error: "exactly_one_recipient_required", version: VERSION });
  }
  if (!subject || typeof subject !== "string" || subject.length > 180) return json(400, { error: "invalid_subject", version: VERSION });
  if (!text || typeof text !== "string" || text.length > 12000) return json(400, { error: "invalid_body", version: VERSION });
  if (!text.includes(REQUIRED_OPT_OUT)) return json(400, { error: "mandatory_opt_out_missing", version: VERSION });
  if (!idempotencyKey || typeof idempotencyKey !== "string" || !leadId || !touchNo) {
    return json(400, { error: "idempotency_metadata_required", version: VERSION });
  }
  if (idempotencyKey !== `${leadId}|${touchNo}`) return json(400, { error: "idempotency_key_mismatch", version: VERSION });

  const recipient = recipients[0].trim().toLowerCase();
  const isInternalTest = recipient === RECEIPT_TO && String(leadId).startsWith("INTERNAL-");
  const store = getStore({ name: "tte-mail-bridge", consistency: "strong" });
  const idempotencyBlob = `direct-idempotency/${idempotencyKey}`;
  const prior = await store.get(idempotencyBlob, { type: "json" });
  if (prior) return json(409, { error: "duplicate_blocked", prior, version: VERSION });

  const dateKey = londonDateKey();
  const counterKey = `direct-daily/${dateKey}`;
  const counter = (await store.get(counterKey, { type: "json" })) as { sent?: number } | null;
  const sentToday = Number(counter?.sent || 0);
  if (!isInternalTest && sentToday >= directRampCap) {
    return json(429, { error: "direct_sender_ramp_reached", sentToday, directRampCap, version: VERSION });
  }

  await store.setJSON(idempotencyBlob, {
    state: "IN_FLIGHT",
    idempotencyKey,
    leadId,
    touchNo,
    recipient,
    reservedAt: new Date().toISOString(),
    version: VERSION,
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
      to: [recipient],
      subject,
      text,
      replyTo: smtpUser,
      headers: {
        "X-TTE-Lead-ID": String(leadId),
        "X-TTE-Touch-No": String(touchNo),
        "X-TTE-Idempotency-Key": String(idempotencyKey),
        "X-TTE-Route": "mailopoly-control-imap-github-netlify-privateemail",
      },
    });

    const sentAt = new Date().toISOString();
    const result = {
      state: "SENT_CONFIRMED",
      route: "MAILOPOLY_CONTROL_IMAP_GITHUB_NETLIFY_PRIVATEEMAIL",
      idempotencyKey,
      leadId,
      touchNo,
      sender: smtpUser,
      recipient,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      sentAt,
      version: VERSION,
    };

    await store.setJSON(idempotencyBlob, result);
    if (!isInternalTest) {
      await store.setJSON(counterKey, { sent: sentToday + 1, updatedAt: sentAt, directRampCap });
    }

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
          `Recipient: ${recipient}`,
          `Provider message ID: ${info.messageId}`,
          `Sent at: ${sentAt}`,
          `Direct cold ramp: ${isInternalTest ? sentToday : sentToday + 1}/${directRampCap}`,
          `Handler: ${VERSION}`,
        ].join("\n"),
      });
    } catch {}

    return json(200, { ...result, directRampCap });
  } catch (error: any) {
    const responseCode = Number(error?.responseCode || 0);
    const temporary = responseCode >= 400 && responseCode < 500;
    const failed = {
      state: temporary ? "DELIVERY_PENDING" : "SEND_FAILED",
      idempotencyKey,
      leadId,
      touchNo,
      recipient,
      failedAt: new Date().toISOString(),
      code: error?.code || null,
      responseCode: responseCode || null,
      message: error?.message || "SMTP send failed",
      version: VERSION,
    };
    await store.setJSON(idempotencyBlob, failed);
    return json(502, failed);
  }
};
