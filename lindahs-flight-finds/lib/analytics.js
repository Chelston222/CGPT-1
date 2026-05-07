export async function trackClientEvent(event, payload = {}) {
  try {
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        pathname: typeof window !== "undefined" ? window.location.pathname : "",
        ...payload
      })
    });
  } catch {
    // Best-effort client tracking only.
  }
}
