// RETIRED 2026-09-01.
// Jotform is no longer a current 222Emails public diagnostic route. This endpoint
// remains fail-closed so a forgotten legacy webhook cannot write obsolete
// attribution events into Klaviyo.

export default async function handler() {
  return new Response(JSON.stringify({
    ok: false,
    error: 'retired_jotform_route',
    currentDiagnostic: 'Free Revenue Recovery Check',
    currentRoute: 'https://tally.so/r/44057b',
  }), {
    status: 410,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
