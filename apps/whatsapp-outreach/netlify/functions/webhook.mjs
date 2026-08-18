import { getStore } from '@netlify/blobs';
import { json, metaConfig } from './_meta.mjs';

export default async (request) => {
  const url = new URL(request.url);
  const config = metaConfig();

  if (request.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token === config.verifyToken) {
      return new Response(challenge || '', { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const payload = await request.json();
    const store = getStore('whatsapp-outreach');
    const receivedAt = new Date().toISOString();

    for (const entry of payload?.entry || []) {
      for (const change of entry?.changes || []) {
        const value = change?.value || {};
        for (const message of value.messages || []) {
          const contact = value.contacts?.find((c) => c.wa_id === message.from) || null;
          const event = {
            type: 'inbound_message',
            from: message.from,
            messageId: message.id,
            messageType: message.type,
            text: message?.text?.body || null,
            profileName: contact?.profile?.name || null,
            receivedAt,
            raw: message
          };
          await store.setJSON(`inbound:${message.id}`, event);
          await store.setJSON(`contact:${message.from}:latest`, event);
          await store.setJSON(`contact:${message.from}:eligibility`, {
            whatsappEligibility: 'customer_initiated',
            lastInboundAt: receivedAt
          });
        }

        for (const status of value.statuses || []) {
          const event = {
            type: 'message_status',
            messageId: status.id,
            recipientId: status.recipient_id || null,
            status: status.status,
            timestamp: status.timestamp || null,
            errors: status.errors || null,
            receivedAt
          };
          await store.setJSON(`status:${status.id}:${status.status}`, event);
        }
      }
    }

    return json(200, { received: true });
  } catch (error) {
    return json(500, { error: error.message });
  }
};
