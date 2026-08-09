const BASE = 'https://payhip.com/api/v2';

function apiKey() {
  const key = Netlify.env.get('PAYHIP_API_KEY');
  if (!key) throw new Error('PAYHIP_API_KEY is not configured');
  return key;
}

async function payhipRequest(path, { method = 'GET', form } = {}) {
  const headers = { 'payhip-api-key': apiKey(), accept: 'application/json' };
  let body;
  if (form) {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(Object.entries(form).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
  }
  const response = await fetch(`${BASE}${path}`, { method, headers, body });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!response.ok) {
    const error = new Error(`Payhip API ${response.status}`);
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

export function listCoupons({ limit = 20, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit: String(Math.min(100, Math.max(1, limit))), offset: String(Math.max(0, offset)) });
  return payhipRequest(`/coupons?${params}`);
}

export function getCoupon(id) {
  return payhipRequest(`/coupons/${encodeURIComponent(id)}`);
}

export function createCoupon(input) {
  const form = {
    code: input.code,
    coupon_type: input.coupon_type,
    percent_off: input.percent_off,
    amount_off: input.amount_off,
    product_key: input.product_key,
    collection_id: input.collection_id,
    usage_limit: input.usage_limit,
    notes: input.notes,
  };
  return payhipRequest('/coupons', { method: 'POST', form });
}
