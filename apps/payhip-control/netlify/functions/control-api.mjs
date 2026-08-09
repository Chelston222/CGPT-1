import { isControlAuthorised, unauthorizedResponse } from './_shared/auth.mjs';
import { listTransactions, listSubscriptions, getTransaction, findCustomer } from './_shared/store.mjs';
import { sanitizeTransaction, summarizeTransactions } from './_shared/core.mjs';
import { listCoupons, getCoupon, createCoupon } from './_shared/payhip-api.mjs';

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

function clampInt(value, fallback, min, max) {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function validateCoupon(input) {
  if (!input || typeof input !== 'object') throw new Error('Body must be JSON');
  if (!/^[A-Za-z0-9_-]{2,64}$/.test(String(input.code || ''))) throw new Error('code must be 2-64 letters, numbers, underscores or hyphens');
  if (!['single', 'multi', 'collection'].includes(input.coupon_type)) throw new Error('coupon_type must be single, multi or collection');
  const hasPercent = input.percent_off !== undefined && input.percent_off !== null;
  const hasAmount = input.amount_off !== undefined && input.amount_off !== null;
  if (hasPercent === hasAmount) throw new Error('Provide exactly one of percent_off or amount_off');
  if (hasPercent && (!(Number(input.percent_off) > 0) || Number(input.percent_off) > 100)) throw new Error('percent_off must be >0 and <=100');
  if (hasAmount && (!Number.isInteger(Number(input.amount_off)) || !(Number(input.amount_off) > 0))) throw new Error('amount_off must be a positive integer in minor currency units');
  if (input.usage_limit !== undefined && (!Number.isInteger(Number(input.usage_limit)) || Number(input.usage_limit) <= 0)) throw new Error('usage_limit must be a positive integer');
  if (input.coupon_type === 'single' && !input.product_key) throw new Error('product_key is required for a single-product coupon');
  if (input.coupon_type === 'collection' && !input.collection_id) throw new Error('collection_id is required for a collection coupon');
}

export default async (request, context) => {
  if (!isControlAuthorised(request)) return unauthorizedResponse();
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    if (request.method === 'GET' && path === '/api/payhip/summary') {
      const days = clampInt(url.searchParams.get('days'), 30, 1, 3650);
      return json(summarizeTransactions(await listTransactions(), { days }));
    }

    if (request.method === 'GET' && path === '/api/payhip/sales') {
      const days = clampInt(url.searchParams.get('days'), 30, 1, 3650);
      const limit = clampInt(url.searchParams.get('limit'), 20, 1, 100);
      const status = url.searchParams.get('status');
      const product = (url.searchParams.get('product') || '').trim().toLowerCase();
      const cutoff = Math.floor(Date.now() / 1000) - days * 86400;
      let rows = (await listTransactions()).filter((t) => (t.created_at ?? t.updated_at ?? 0) >= cutoff);
      if (status) rows = rows.filter((t) => t.status === status);
      if (product) rows = rows.filter((t) => (t.items || []).some((i) => `${i.product_name || ''} ${i.product_key || ''}`.toLowerCase().includes(product)));
      rows.sort((a, b) => (b.created_at ?? b.updated_at ?? 0) - (a.created_at ?? a.updated_at ?? 0));
      return json({ days, count: Math.min(limit, rows.length), sales: rows.slice(0, limit).map((t) => sanitizeTransaction(t)) });
    }

    if (request.method === 'GET' && path.startsWith('/api/payhip/transactions/')) {
      const id = context.params?.id || decodeURIComponent(path.split('/').pop());
      const tx = await getTransaction(id);
      return tx ? json(tx) : json({ error: 'not_found' }, 404);
    }

    if (request.method === 'GET' && path === '/api/payhip/customer') {
      const email = (url.searchParams.get('email') || '').trim().toLowerCase();
      if (!email.includes('@')) return json({ error: 'valid email is required' }, 400);
      return json(await findCustomer(email));
    }

    if (request.method === 'GET' && path === '/api/payhip/subscriptions') {
      const email = (url.searchParams.get('email') || '').trim().toLowerCase();
      const status = url.searchParams.get('status');
      let rows = await listSubscriptions();
      if (email) rows = rows.filter((s) => s.email === email);
      if (status) rows = rows.filter((s) => s.status === status);
      rows.sort((a, b) => (b.updated_at ?? 0) - (a.updated_at ?? 0));
      return json({ count: rows.length, subscriptions: rows.slice(0, 100) });
    }

    if (path === '/api/payhip/coupons' && request.method === 'GET') {
      const limit = clampInt(url.searchParams.get('limit'), 20, 1, 100);
      const offset = clampInt(url.searchParams.get('offset'), 0, 0, 1000000);
      return json(await listCoupons({ limit, offset }));
    }

    if (request.method === 'GET' && path.startsWith('/api/payhip/coupons/')) {
      const id = context.params?.id || decodeURIComponent(path.split('/').pop());
      return json(await getCoupon(id));
    }

    if (path === '/api/payhip/coupons' && request.method === 'POST') {
      const input = await request.json();
      validateCoupon(input);
      return json(await createCoupon(input), 201);
    }

    return json({ error: 'not_found' }, 404);
  } catch (error) {
    console.error('Payhip control API error', error?.message || error);
    const status = Number(error?.status) || 500;
    return json({ error: status >= 500 ? 'internal_error' : 'upstream_error', message: error?.message || 'Unknown error', details: status < 500 ? error?.details : undefined }, status);
  }
};

export const config = {
  path: [
    '/api/payhip/summary',
    '/api/payhip/sales',
    '/api/payhip/transactions/:id',
    '/api/payhip/customer',
    '/api/payhip/subscriptions',
    '/api/payhip/coupons',
    '/api/payhip/coupons/:id',
  ],
};
