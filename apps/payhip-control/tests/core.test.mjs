import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256Hex, verifyPayhipSignature, normalizePayhipEvent, transactionFromEvent, subscriptionFromEvent, summarizeTransactions, sanitizeTransaction } from '../netlify/functions/_shared/core.mjs';
import openapiHandler from '../netlify/functions/openapi.mjs';

const apiKey = 'payhip-test-secret';

function paid(overrides = {}) {
  return {
    id: 'TX123', email: 'Buyer@Example.com', currency: 'GBP', price: 2700, vat_applied: true,
    items: [{ product_id: '1', product_name: 'Quiet Week Recovery Kit', product_key: 'QWK1', quantity: '1' }],
    payment_type: 'card', stripe_fee: 81, payhip_fee: 135, unconsented_from_emails: false, is_gift: false,
    date: 1786310000, type: 'paid', signature: sha256Hex(apiKey), ...overrides,
  };
}

test('valid Payhip signature is accepted and a wrong one is rejected', () => {
  assert.equal(verifyPayhipSignature(paid(), apiKey), true);
  assert.equal(verifyPayhipSignature({ ...paid(), signature: '0'.repeat(64) }, apiKey), false);
});

test('paid event is normalized without retaining Payhip IP address', () => {
  const event = normalizePayhipEvent({ ...paid(), ip_address: '203.0.113.8' });
  assert.equal(event.email, 'buyer@example.com');
  assert.equal(event.gross_minor, 2700);
  assert.equal(event.items[0].product_name, 'Quiet Week Recovery Kit');
  assert.equal('ip_address' in event, false);
});

test('refund updates transaction state correctly', () => {
  const first = transactionFromEvent(normalizePayhipEvent(paid()));
  const refundEvent = normalizePayhipEvent({ ...paid(), type: 'refunded', amount_refunded: 700, date_created: 1786310000, date_refunded: 1786313600 });
  const partial = transactionFromEvent(refundEvent, first);
  assert.equal(partial.status, 'partially_refunded');
  assert.equal(partial.amount_refunded_minor, 700);
});

test('summary keeps currencies separate and counts product units', () => {
  const tx = transactionFromEvent(normalizePayhipEvent(paid()));
  const summary = summarizeTransactions([tx], { days: 30, nowEpoch: 1786310000 + 60 });
  assert.equal(summary.transaction_count, 1);
  assert.equal(summary.currencies[0].gross_minor, 2700);
  assert.equal(summary.top_products[0].units, 1);
});

test('recent-sale sanitization hides customer email by default', () => {
  const tx = transactionFromEvent(normalizePayhipEvent(paid()));
  assert.equal('email' in sanitizeTransaction(tx), false);
  assert.equal(sanitizeTransaction(tx, { includeCustomer: true }).email, 'buyer@example.com');
});

test('full refund marks the transaction refunded and zeroes net after known fees', () => {
  const first = transactionFromEvent(normalizePayhipEvent(paid()));
  const refundEvent = normalizePayhipEvent({
    ...paid(),
    type: 'refunded',
    amount_refunded: 2700,
    date_created: 1786310000,
    date_refunded: 1786317200,
  });
  const refunded = transactionFromEvent(refundEvent, first);
  assert.equal(refunded.status, 'refunded');
  assert.equal(refunded.amount_refunded_minor, 2700);
  assert.equal(refunded.net_after_known_fees_minor, 0);
});

test('subscription lifecycle preserves identity and marks deletion as canceled', () => {
  const createdEvent = normalizePayhipEvent({
    type: 'subscription.created',
    subscription_id: 'SUB-1',
    customer_id: 'CUS-1',
    customer_email: 'Member@Example.com',
    status: 'active',
    plan_name: 'Monthly',
    product_name: 'Retention Membership',
    product_link: 'https://example.test/product',
    gdpr_consent: 'yes',
    date_subscription_started: 1786310000,
  });
  const created = subscriptionFromEvent(createdEvent);
  assert.equal(created.status, 'active');
  assert.equal(created.email, 'member@example.com');

  const deletedEvent = normalizePayhipEvent({
    type: 'subscription.deleted',
    subscription_id: 'SUB-1',
    customer_id: 'CUS-1',
    customer_email: 'Member@Example.com',
    date_subscription_started: 1786310000,
    date_subscription_deleted: 1786400000,
  });
  const deleted = subscriptionFromEvent(deletedEvent, created);
  assert.equal(deleted.status, 'canceled');
  assert.equal(deleted.email, 'member@example.com');
  assert.equal(deleted.started_at, 1786310000);
  assert.equal(deleted.updated_at, 1786400000);
});

test('unsupported Payhip event types are rejected', () => {
  assert.throws(() => normalizePayhipEvent({ type: 'mystery.event' }), /Unsupported Payhip event type/);
});

test('OpenAPI schema exposes protected reads and marks coupon creation consequential', async () => {
  const response = await openapiHandler(new Request('https://payhip-control.example/openapi.json'));
  assert.equal(response.status, 200);
  const spec = await response.json();
  assert.equal(spec.openapi, '3.1.0');
  assert.equal(spec.paths['/api/payhip/summary'].get.operationId, 'getPayhipSummary');
  assert.equal(spec.paths['/api/payhip/coupons'].post['x-openai-isConsequential'], true);
  assert.deepEqual(spec.security, [{ bearerAuth: [] }]);
});
