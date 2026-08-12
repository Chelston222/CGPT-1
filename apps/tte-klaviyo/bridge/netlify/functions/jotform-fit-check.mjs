import { createHash, timingSafeEqual } from "node:crypto";

const KLAVIYO_BASE = "https://a.klaviyo.com/api";
const KLAVIYO_REVISION = "2026-07-15";
const EXPECTED_FORM_ID = "262067771632056";
const METRIC_NAME = "TTE Fit Check Submitted";

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function safeEqual(a = "", b = "") {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function validEmail(value) {
  if (typeof value !== "string" || value.length > 100) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function collectEmailCandidates(value, key = "", out = []) {
  if (typeof value === "string" && validEmail(value)) {
    out.push({ email: value.trim().toLowerCase(), score: /email/i.test(key) ? 2 : 1 });
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectEmailCandidates(item, `${key}[${index}]`, out));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([childKey, child]) => collectEmailCandidates(child, childKey, out));
  }
  return out;
}

function chooseEmail(payload) {
  const candidates = collectEmailCandidates(payload)
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.email || null;
}

function stableUuidFromSubmission(submissionId) {
  const hex = createHash("sha256").update(`tte-jotform-fit-check:${submissionId}`).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function parseJotformRequest(req) {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await req.json();
    const raw = typeof body.rawRequest === "string" ? JSON.parse(body.rawRequest) : (body.rawRequest || body);
    return {
      formId: String(body.formID || body.formId || raw.formID || raw.formId || ""),
      submissionId: String(body.submissionID || body.submissionId || raw.submissionID || raw.submissionId || ""),
      raw,
    };
  }

  const form = await req.formData();
  const rawRequest = form.get("rawRequest");
  if (typeof rawRequest !== "string" || !rawRequest.trim()) {
    throw new Error("rawRequest is missing from Jotform webhook payload");
  }
  const raw = JSON.parse(rawRequest);
  return {
    formId: String(form.get("formID") || form.get("formId") || raw.formID || raw.formId || ""),
    submissionId: String(form.get("submissionID") || form.get("submissionId") || raw.submissionID || raw.submissionId || ""),
    raw,
  };
}

async function sendKlaviyoEvent({ email, submissionId }) {
  const key = process.env.KLAVIYO_PRIVATE_API_KEY;
  if (!key) throw new Error("KLAVIYO_PRIVATE_API_KEY is not configured");

  const payload = {
    data: {
      type: "event",
      attributes: {
        properties: {
          source: "jotform_fit_check",
          form_id: EXPECTED_FORM_ID,
          submission_id: submissionId,
          qa: false,
        },
        metric: {
          data: {
            type: "metric",
            attributes: { name: METRIC_NAME },
          },
        },
        profile: {
          data: {
            type: "profile",
            attributes: { email },
          },
        },
        unique_id: stableUuidFromSubmission(submissionId),
      },
    },
  };

  const response = await fetch(`${KLAVIYO_BASE}/events`, {
    method: "POST",
    headers: {
      Authorization: `Klaviyo-API-Key ${key}`,
      accept: "application/vnd.api+json",
      "content-type": "application/vnd.api+json",
      revision: KLAVIYO_REVISION,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Klaviyo event rejected (${response.status}): ${detail.slice(0, 700)}`);
  }
  return response.status;
}

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const configuredSecret = process.env.JOTFORM_WEBHOOK_SECRET || "";
  const suppliedSecret = new URL(req.url).searchParams.get("key") || "";
  if (!configuredSecret || !safeEqual(suppliedSecret, configuredSecret)) {
    return json({ ok: false, error: "unauthorised" }, 401);
  }

  try {
    const { formId, submissionId, raw } = await parseJotformRequest(req);
    if (formId !== EXPECTED_FORM_ID) return json({ ok: false, error: "wrong_form" }, 403);
    if (!/^\d+$/.test(submissionId)) return json({ ok: false, error: "missing_submission_id" }, 400);

    const email = chooseEmail(raw);
    if (!email) return json({ ok: false, error: "business_email_not_found" }, 422);

    const klaviyoStatus = await sendKlaviyoEvent({ email, submissionId });
    return json({ ok: true, accepted: true, klaviyo_status: klaviyoStatus }, 202);
  } catch (error) {
    console.error("TTE Fit Check bridge failure", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return json({ ok: false, error: "bridge_failure" }, 500);
  }
};

export const config = {
  path: "/api/tte-fit-check",
};
