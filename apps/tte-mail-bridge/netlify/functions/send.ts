import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import nodemailer from "nodemailer";

const REQUIRED_OPT_OUT = "If you'd rather I didn't follow up, just let me know.";
const MAX_RECIPIENTS = 1;
const DEFAULT_DAILY_CAP = 20;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
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
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const bridgeToken = Netlify.env.get("TTE_BRIDGE_TOKEN");
  const auth = req.headers.get("authorization") || "";
  if (!bridgeToken || auth !== `Bearer ${bridgeToken}`) {
    return json(401, { error: "unauthorised" });
  }

  const smtpUser = Netlify.env.get("TTE_SMTP_USER") || "hello@222emails.com";
  const smtpPass = Netlify.env.get("TTE_SMTP_PASS");
  const smtpHost = Netlify.env.get("TTE_SMTP_HOST") || "mail.privateemail.com";
  const smtpPort = Number(Netlify.env.get("TTE_SMTP_PORT") || "465");
  const dailyCap = Number(Netlify.env.get("TTE_DIRECT_DAILY_CAP") || DEFAULT_DAILY_CAP);

  if (!smtpPass) return json(503, { error: "smtp_secret_missing" });

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const { to, subject, text, idempotencyKey, leadId, touchNo } = payload || {};
  if (!Array.isArray(to) || to.length !== MAX_RECIPIENTS || typeof to[0] !== "string") {
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

  const store = getStore({ name: "tte-mail-bridge", consistency: "strong" });
  const idempotencyBlob = `idempotency/${idempotencyKey}`;
  const prior = await store.get(idempotencyBlob, { type: "json" });
  if (prior) return json(409, { error: "duplicate_blocked", prior });

  const dateKey = londonDateKey();
  const counterKey = `daily/${dateKey}`;
  const counter = (await store.get(counterKey, { type: "json" })) as { sent?: number } | null;
  const sentToday = Number(counter?.sent || 0);
  if (sentToday >= dailyCap) {
    return json(429, { error: "direct_daily_cap_reached", sentToday, dailyCap });
  }

  // Reserve before SMTP to fail closed against concurrent duplicate calls.
  await store.setJSON(idempotencyBlob, {
    state: "IN_FLIGHT",
    idempotencyKey,
    leadId,
    touchNo,
    recipient: to[0],
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
      to,
      subject,
      text,
      replyTo: smtpUser,
      headers: {
        "X-TTE-Lead-ID": String(leadId),
        "X-TTE-Touch-No": String(touchNo),
        "X-TTE-Idempotency-Key": String(idempotencyKey),
      },
    });

    const result = {
      state: "SENT_CONFIRMED",
      idempotencyKey,
      leadId,
      touchNo,
      sender: smtpUser,
      recipient: to[0],
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      sentAt: new Date().toISOString(),
    };

    await store.setJSON(idempotencyBlob, result);
    await store.setJSON(counterKey, { sent: sentToday + 1, updatedAt: result.sentAt });
    return json(200, result);
  } catch (error: any) {
    const failed = {
      state: "SEND_FAILED",
      idempotencyKey,
      leadId,
      touchNo,
      recipient: to[0],
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
  path: "/api/tte/send",
  method: ["POST"],
};
