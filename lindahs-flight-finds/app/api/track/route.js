export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  console.log('tracking-event', body);
  return Response.json({ ok: true });
}
