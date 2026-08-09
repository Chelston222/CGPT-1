import { getStore } from '@netlify/blobs';
import { sha256Hex, transactionFromEvent, subscriptionFromEvent } from './core.mjs';

const eventsStore = () => getStore({ name: 'payhip-events', consistency: 'strong' });
const stateStore = () => getStore({ name: 'payhip-state', consistency: 'strong' });

function eventKey(event) {
  const stamp = event.occurred_at ? new Date(event.occurred_at * 1000).toISOString().replace(/[:.]/g, '-') : 'unknown-time';
  return `events/${stamp}-${sha256Hex(event.event_id).slice(0, 24)}.json`;
}

export async function persistEvent(event) {
  const events = eventsStore();
  const state = stateStore();
  const key = eventKey(event);
  const existing = await events.get(key, { type: 'json' });
  if (!existing) {
    await events.setJSON(key, event, {
      metadata: { type: event.type, occurredAt: event.occurred_at || 0, eventId: event.event_id },
    });
  }

  if (event.kind === 'transaction') {
    const stateKey = `transactions/${event.transaction_id}.json`;
    const previous = await state.get(stateKey, { type: 'json' });
    const next = transactionFromEvent(event, previous);
    await state.setJSON(stateKey, next, { metadata: { status: next.status, updatedAt: next.updated_at || 0 } });
  } else {
    const stateKey = `subscriptions/${event.subscription_id}.json`;
    const previous = await state.get(stateKey, { type: 'json' });
    const next = subscriptionFromEvent(event, previous);
    await state.setJSON(stateKey, next, { metadata: { status: next.status, updatedAt: next.updated_at || 0 } });
  }

  await state.setJSON('meta/last-event.json', {
    event_id: event.event_id,
    type: event.type,
    occurred_at: event.occurred_at,
    received_at: Math.floor(Date.now() / 1000),
  });

  return { duplicate: Boolean(existing), key };
}

async function readAll(prefix) {
  const store = stateStore();
  const { blobs } = await store.list({ prefix });
  const rows = await Promise.all(blobs.map((blob) => store.get(blob.key, { type: 'json' })));
  return rows.filter(Boolean);
}

export async function listTransactions() {
  return readAll('transactions/');
}

export async function listSubscriptions() {
  return readAll('subscriptions/');
}

export async function getTransaction(id) {
  return stateStore().get(`transactions/${id}.json`, { type: 'json' });
}

export async function findCustomer(email) {
  const needle = String(email || '').trim().toLowerCase();
  const [transactions, subscriptions] = await Promise.all([listTransactions(), listSubscriptions()]);
  return {
    email: needle,
    transactions: transactions.filter((t) => t.email === needle),
    subscriptions: subscriptions.filter((s) => s.email === needle),
  };
}

export async function getLastEventMeta() {
  return stateStore().get('meta/last-event.json', { type: 'json' });
}
