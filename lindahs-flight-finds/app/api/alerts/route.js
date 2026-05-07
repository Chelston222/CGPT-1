const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(data, init) {
  return Response.json(data, init);
}

async function sendToWebhook(payload) {
  if (!process.env.WAITLIST_WEBHOOK_URL) return { delivered: false, provider: "none" };

  const response = await fetch(process.env.WAITLIST_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.WAITLIST_WEBHOOK_SECRET
        ? { Authorization: `Bearer ${process.env.WAITLIST_WEBHOOK_SECRET}` }
        : {})
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`waitlist webhook failed: ${response.status} ${body}`);
  }

  return { delivered: true, provider: "webhook" };
}

async function sendToResend(payload) {
  if (!process.env.RESEND_API_KEY) return { delivered: false, provider: "none" };

  const response = await fetch("https://api.resend.com/contacts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: payload.email,
      unsubscribed: false,
      firstName: payload.firstName || undefined,
      properties: {
        source: payload.source,
        interest: payload.interest || "cheap-flight-alerts",
        consent_marketing: String(payload.consentMarketing),
        consent_timestamp: payload.consentTimestamp,
        region: payload.region || "UK"
      },
      ...(process.env.RESEND_TOPIC_ID
        ? {
            topics: [{ id: process.env.RESEND_TOPIC_ID, subscription: "opt_in" }]
          }
        : {})
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`resend contact creation failed: ${response.status} ${body}`);
  }

  return { delivered: true, provider: "resend" };
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const consentMarketing = Boolean(body.consentMarketing);
  const source = typeof body.source === "string" ? body.source : "site-alerts-form";
  const consentTimestamp = new Date().toISOString();

  if (!EMAIL_RE.test(email)) {
    return json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }

  if (!consentMarketing) {
    return json({ ok: false, error: "Marketing consent is required before signup." }, { status: 400 });
  }

  const payload = {
    email,
    firstName,
    consentMarketing,
    consentTimestamp,
    source,
    interest: "cheap-flight-alerts",
    region: process.env.NEXT_PUBLIC_BRAND_REGION || "UK"
  };

  try {
    const resendResult = await sendToResend(payload);
    const webhookResult = await sendToWebhook(payload);
    const provider = resendResult.delivered
      ? resendResult.provider
      : webhookResult.delivered
        ? webhookResult.provider
        : "none";

    if (provider === "none") {
      return json(
        {
          ok: false,
          error: "Signup backend is not configured yet. Add Resend or webhook environment variables."
        },
        { status: 503 }
      );
    }

    return json({ ok: true, provider });
  } catch (error) {
    return json(
      {
        ok: false,
        error: "Signup failed. Check provider configuration.",
        details: error instanceof Error ? error.message : "unknown error"
      },
      { status: 502 }
    );
  }
}
