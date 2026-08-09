import { createHash, timingSafeEqual } from 'node:crypto';

export const PAYHIP_EVENT_TYPES = new Set([
  'paid',
  'refunded',
  'subscription.created',
  'subscription.deleted',
]);

export function sha256Hex(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

export function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (!/^[a-f0-9]{64}$/i.test(a) || !/^[a-f0-9]{64}$/i.test(b)) return false;
  const left = Buffer.from(a.toLowerCase(), 'hex');
  const right = Buffer.from(b.toLowerCase(), 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyPayhipSignature(payload, apiKey) {
  if (!apiKey || !payload?.signature) return false;
  return safeEqualHex(payload.signature, sha256Hex(apiKey));
}

function cleanEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.includes('@') ? email : null;
}

function intOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function epochOrNull(value) {
  const parsed = intOrNull(value);
  return parsed && parsed > 0 ? parsed : null;
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    product_id: item?.product_id ? String(item.product_id) : null,
    product_name: item?.product_name ? String(item.product_name) : null,
    product_key: item?.product_key ? String(item.product_key) : null,
    product_permalink: item?.product_permalink ? String(item.product_permalink) : null,
    quantity: intOrNull(item?.quantity) ?? 1,
    on_sale: Boolean(item?.on_sale),
    used_coupon: Boolean(item?.used_coupon),
    used_cross_sell_discount: Boolean(item?.used_cross_sell_discount),
    used_upgrade_discount: Boolean(item?.used_upgrade_discount),
    promoted_by_affiliate: Boolean(item?.promoted_by_affiliate),
    has_variant: Boolean(item?.has_variant),
  }));
}

export function normalizePayhipEvent(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Webhook body must be an object');
  const type = String(payload.type || '');
  if (!PAYHIP_EVENT_TYPES.has(type)) throw new Error(`Unsupported Payhip event type: ${type || 'missing'}`);

  if (type === 'paid' || type === 'refunded') {
    const id = payload.id ? String(payload.id) : null;
    if (!id) throw new Error('Transaction event is missing id');
    const price = intOrNull(payload.price) ?? 0;
    const amountRefunded = type === 'refunded' ? (intOrNull(payload.amount_refunded) ?? 0) : 0;
    const occurredAt = type === 'refunded'
      ? (epochOrNull(payload.date_refunded) ?? epochOrNull(payload.date_created))
      : epochOrNull(payload.date);

    return {
      kind: 'transaction',
      type,
      event_id: `${type}:${id}:${occurredAt ?? 'unknown'}:${amountRefunded}`,
      transaction_id: id,
      email: cleanEmail(payload.email),
      currency: String(payload.currency || '').toUpperCase() || null,
      gross_minor: price,
      amount_refunded_minor: amountRefunded,
      stripe_fee_minor: intOrNull(payload.stripe_fee),
      payhip_fee_minor: intOrNull(payload.payhip_fee),
      payment_type: payload.payment_type ? String(payload.payment_type) : null,
      vat_applied: Boolean(payload.vat_applied),
      marketing_unconsented: Boolean(payload.unconsented_from_emails),
      is_gift: Boolean(payload.is_gift),
      items: normalizeItems(payload.items),
      occurred_at: occurredAt,
      source: 'payhip',
    };
  }

  const subscriptionId = payload.subscription_id ? String(payload.subscription_id) : null;
  if (!subscriptionId) throw new Error('Subscription event is missing subscription_id');
  const occurredAt = type === 'subscription.deleted'
    ? (epochOrNull(payload.date_subscription_deleted) ?? epochOrNull(payload.date_subscription_started))
    : epochOrNull(payload.date_subscription_started);

  return {
    kind: 'subscription',
    type,
    event_id: `${type}:${subscriptionId}:${occurredAt ?? 'unknown'}`,
    subscription_id: subscriptionId,
    customer_id: payload.customer_id ? String(payload.customer_id) : null,
    email: cleanEmail(payload.customer_email),
    status: payload.status ? String(payload.status) : (type === 'subscription.deleted' ? 'canceled' : 'active'),
    plan_name: payload.plan_name ? String(payload.plan_name) : null,
    product_name: payload.product_name ? String(payload.product_name) : null,
    product_link: payload.product_link ? String(payload.product_link) : null,
    gdpr_consent: payload.gdpr_consent ? String(payload.gdpr_consent) : null,
    customer_first_name: payload.customer_first_name ? String(payload.customer_first_name) : null,
    customer_last_name: payload.customer_last_name ? String(payload.customer_last_name) : null,
    occurred_at: occurredAt,
    source: 'payhip',
  };
}

export function transactionFromEvent(event, previous = null) {
  if (event.kind !== 'transaction') throw new Error('Expected transaction event');
  const refunded = event.type === 'refunded' ? event.amount_refunded_minor : (previous?.amount_refunded_minor ?? 0);
  const gross = event.gross_minor;
  const status = refunded >= gross && gross > 0 ? 'refunded' : refunded > 0 ? 'partially_refunded' : 'paid';
  const fees = [event.stripe_fee_minor, event.payhip_fee_minor]
    .filter((v) => Number.isInteger(v))
    .reduce((a, b) => a + b, 0);

  return {
    transaction_id: event.transaction_id,
    email: event.email ?? previous?.email ?? null,
    currency: event.currency ?? previous?.currency ?? null,
    gross_minor: gross || previous?.gross_minor || 0,
    amount_refunded_minor: refunded,
    known_fees_minor: fees || previous?.known_fees_minor || 0,
    net_after_known_fees_minor: Math.max(0, (gross || previous?.gross_minor || 0) - refunded - (fees || previous?.known_fees_minor || 0)),
    payment_type: event.payment_type ?? previous?.payment_type ?? null,
    vat_applied: event.vat_applied,
    marketing_unconsented: event.marketing_unconsented,
    is_gift: event.is_gift,
    items: event.items.length ? event.items : (previous?.items ?? []),
    status,
    created_at: event.type === 'paid' ? event.occurred_at : (previous?.created_at ?? event.occurred_at),
    updated_at: event.occurred_at,
  };
}

export function subscriptionFromEvent(event, previous = null) {
  if (event.kind !== 'subscription') throw new Error('Expected subscription event');
  return {
    subscription_id: event.subscription_id,
    customer_id: event.customer_id ?? previous?.customer_id ?? null,
    email: event.email ?? previous?.email ?? null,
    status: event.type === 'subscription.deleted' ? 'canceled' : (event.status || 'active'),
    plan_name: event.plan_name ?? previous?.plan_name ?? null,
    product_name: event.product_name ?? previous?.product_name ?? null,
    product_link: event.product_link ?? previous?.product_link ?? null,
    gdpr_consent: event.gdpr_consent ?? previous?.gdpr_consent ?? null,
    customer_first_name: event.customer_first_name ?? previous?.customer_first_name ?? null,
    customer_last_name: event.customer_last_name ?? previous?.customer_last_name ?? null,
    started_at: event.type === 'subscription.created' ? event.occurred_at : (previous?.started_at ?? null),
    updated_at: event.occurred_at,
  };
}

export function summarizeTransactions(transactions, { days = 30, nowEpoch = Math.floor(Date.now() / 1000) } = {}) {
  const cutoff = nowEpoch - Math.max(1, Number(days) || 30) * 86400;
  const filtered = transactions.filter((t) => (t.created_at ?? t.updated_at ?? 0) >= cutoff);
  const byCurrency = {};
  const products = new Map();

  for (const tx of filtered) {
    const currency = tx.currency || 'UNKNOWN';
    const bucket = byCurrency[currency] ||= {
      currency,
      transactions: 0,
      paid: 0,
      partially_refunded: 0,
      refunded: 0,
      gross_minor: 0,
      refunded_minor: 0,
      known_fees_minor: 0,
      net_after_known_fees_minor: 0,
    };
    bucket.transactions += 1;
    bucket[tx.status] = (bucket[tx.status] || 0) + 1;
    bucket.gross_minor += tx.gross_minor || 0;
    bucket.refunded_minor += tx.amount_refunded_minor || 0;
    bucket.known_fees_minor += tx.known_fees_minor || 0;
    bucket.net_after_known_fees_minor += tx.net_after_known_fees_minor || 0;

    for (const item of tx.items || []) {
      const key = item.product_key || item.product_id || item.product_name || 'unknown';
      const current = products.get(key) || {
        product_key: item.product_key || null,
        product_id: item.product_id || null,
        product_name: item.product_name || 'Unknown product',
        units: 0,
        transactions: 0,
      };
      current.units += item.quantity || 1;
      current.transactions += 1;
      products.set(key, current);
    }
  }

  return {
    days: Math.max(1, Number(days) || 30),
    transaction_count: filtered.length,
    currencies: Object.values(byCurrency),
    top_products: [...products.values()].sort((a, b) => b.units - a.units || b.transactions - a.transactions).slice(0, 10),
  };
}

export function sanitizeTransaction(tx, { includeCustomer = false } = {}) {
  if (!tx) return null;
  const copy = { ...tx };
  if (!includeCustomer) delete copy.email;
  return copy;
}
