import type { Config, Context } from "@netlify/functions";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { enqueueOutbound } from "./_shared/queue-service.mjs";
import { audit } from "./_shared/store.mjs";
import { jsonResponse, shortHash } from "./_shared/util.mjs";

const LEGACY_HOOK_TOKEN_SHA256 = "2e8ce87c7d1e57606e0c634e8e0ba17c88252d3afe4570bfd7894accf5b0fa62";
const LEGACY_DISPATCH_TOKEN_SHA256 = "4a985ff35e497b384825768cdf87f06080a98642048caa8467220f0d0f37bbe1";
const HANDLER_VERSION = "2026-08-16-apex-v5";

function safeEqualText(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

function hashMatches(value: string | null | undefined, expectedHex: string) {
  if (!value) return false;
  const actual = createHash("sha256").update(value).digest("hex");
  return safeEqualText(actual, expectedHex);
}

function tokenMatches(req: Request) {
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const legacy = new URL(req.url).searchParams.get("k") || "";
  const candidate = bearer || legacy;
  const expected = Netlify.env.get("TTE_AGENT_HOOK_TOKEN_SHA256") || LEGACY_HOOK_TOKEN_SHA256;
  return hashMatches(candidate, expected);
}

function dispatchTokenMatches(value: string | null | undefined) {
  const expected = Netlify.env.get("TTE_AGENT_DISPATCH_TOKEN_SHA256") || LEGACY_DISPATCH_TOKEN_SHA256;
  return hashMatches(value, expected);
}

function signatureMatches(rawBody: string, signature: string | null) {
  const secret = Netlify.env.get("TTE_MAILOPOLY_WEBHOOK_SECRET");
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const actual = signature.slice("sha256=".length).trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(actual)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualText(actual, expected);
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
      if (!(key in value)) continue;
      const candidate = value[key];
      if (key === "message" && (typeof candidate === "string" || typeof candidate === "object")) return candidate;
      const found = findMessage(candidate, depth + 1);
      if (found) return found;
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

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return jsonResponse(405, { error: "method_not_allowed", version: HANDLER_VERSION });

  const rawBody = await req.text();
  let webhookPayload: any;
  try { webhookPayload = JSON.parse(rawBody); }
  catch { return jsonResponse(400, { error: "invalid_webhook_json", version: HANDLER_VERSION }); }

  const payload = parseAgentPayload(webhookPayload);
  const authorised =
    tokenMatches(req) ||
    signatureMatches(rawBody, req.headers.get("x-mailopoly-signature")) ||
    dispatchTokenMatches(payload?.dispatchAuth);
  if (!authorised) return jsonResponse(401, { error: "unauthorised", version: HANDLER_VERSION });

  if (!payload || typeof payload !== "object") {
    await audit("AGENT_HOOK_REJECTED", { error: "missing_agent_message", version: HANDLER_VERSION }).catch(() => {});
    return jsonResponse(400, { error: "missing_agent_message", version: HANDLER_VERSION });
  }

  const { leadId, touchNo, idempotencyKey } = payload;
  if (!leadId || !Number.isInteger(Number(touchNo)) || Number(touchNo) < 1 || !idempotencyKey) {
    return jsonResponse(400, { error: "idempotency_metadata_required", version: HANDLER_VERSION });
  }
  if (String(idempotencyKey) !== `${leadId}|${Number(touchNo)}`) {
    return jsonResponse(400, { error: "idempotency_key_mismatch", version: HANDLER_VERSION });
  }

  // Critical invariant: Mailopoly is ingress only. It never creates a transport or submits
  // to Gmail/SMTP. All prospect messages inherit the same encrypted queue, review,
  // suppression, emergency-stop, pacing, idempotency and sender-health controls.
  const { dispatchAuth: _discardDispatchAuth, ...safePayload } = payload;
  const result = await enqueueOutbound({
    ...safePayload,
    touchNo: Number(touchNo),
    campaignName: payload.campaignName || "Mailopoly agent",
    source: payload.source || "mailopoly-agent-hook",
  });

  await audit(result.ok ? "AGENT_HOOK_QUEUED" : "AGENT_HOOK_REJECTED", {
    leadHash: shortHash(String(leadId), 48),
    touchNo: Number(touchNo),
    queueId: result.queueId || null,
    state: result.state || null,
    error: result.error || null,
    version: HANDLER_VERSION,
  }).catch(() => {});

  return jsonResponse(result.status, {
    ...result,
    route: "MAILOPOLY_TO_TTE_CONTROL_PLANE",
    deliveryMode: "queued",
    version: HANDLER_VERSION,
  });
};

export const config: Config = {
  path: "/api/tte/agent-hook",
  method: ["POST"],
};
