import { timingSafeEqual } from 'node:crypto';

function safeTextEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

export function isControlAuthorised(request) {
  const expected = Netlify.env.get('CONTROL_API_TOKEN');
  if (!expected) return false;
  const auth = request.headers.get('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return false;
  return safeTextEqual(auth.slice(7).trim(), expected);
}

export function unauthorizedResponse() {
  return Response.json({ error: 'unauthorized' }, { status: 401, headers: { 'cache-control': 'no-store' } });
}
