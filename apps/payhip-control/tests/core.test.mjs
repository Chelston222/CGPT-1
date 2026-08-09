import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256Hex, verifyPayhipSignature, normalizePayhipEvent, transactionFromEvent, summarizeTransactions, sanitizeTransaction } from '../netlify/functions/_shared/core.mjs';

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
