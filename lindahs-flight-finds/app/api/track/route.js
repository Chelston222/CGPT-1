const ALLOWED_EVENTS = new Set([
  "deal_selected",
  "saved_toggled",
  "compare_toggled",
  "alerts_joined",
  "outbound_click"
]);

async function forwardEvent(event) {
  if (!process.env.TRACK_EVENTS_WEBHOOK_URL) return false;

  const response = await fetch(process.env.TRACK_EVENTS_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.TRACK_EVENTS_WEBHOOK_SECRET
        ? { Authorization: `Bearer ${process.env.TRACK_EVENTS_WEBHOOK_SECRET}` }
        : {})
    },
    body: JSON.stringify(event),
    cache: "no-store"
  });

  return response.ok;
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const event = typeof body.event === "string" ? body.event : "";

  if (!ALLOWED_EVENTS.has(event)) {
    return Response.json({ ok: false, error: "Unsupported event." }, { status: 400 });
  }

  const payload = {
    event,
    createdAt: new Date().toISOString(),
    pathname: typeof body.pathname === "string" ? body.pathname : "",
    slug: typeof body.slug === "string" ? body.slug : "",
    extra: typeof body === "object" && body ? body : {}
  };

  console.log("tracking-event", payload);
  const forwarded = await forwardEvent(payload).catch(() => false);
  return Response.json({ ok: true, forwarded });
}
