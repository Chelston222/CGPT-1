import { getStore } from '@netlify/blobs';
import { json, metaConfig, metaRequest, normalizePhone } from './_meta.mjs';

const ELIGIBLE = new Set(['opted_in', 'customer_initiated']);

export default async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const input = await request.json();
    const to = normalizePhone(input.to);
    if (!to) return json(400, { error: 'A recipient phone number is required.' });

    const eligibility = String(input.whatsappEligibility || '').toLowerCase();
    if (!ELIGIBLE.has(eligibility)) {
      return json(409, {
        error: 'Recipient is not WhatsApp-eligible for automated outreach.',
        required: ['opted_in', 'customer_initiated']
      });
    }

    const { phoneNumberId } = metaConfig();
    const mode = input.mode || 'text';
    let payload;

    if (mode === 'template') {
      if (!input.templateName) return json(400, { error: 'templateName is required.' });
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
          name: input.templateName,
          language: { code: input.languageCode || 'en_GB' },
          ...(Array.isArray(input.components) ? { components: input.components } : {})
        }
      };
    } else if (mode === 'document') {
      const doc = input.document || {};
      if (!doc.id && !doc.link) return json(400, { error: 'document.id or document.link is required.' });
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'document',
        document: {
          ...(doc.id ? { id: doc.id } : { link: doc.link }),
          ...(doc.filename ? { filename: doc.filename } : {}),
          ...(doc.caption ? { caption: doc.caption } : {})
        }
      };
    } else {
      if (!input.text) return json(400, { error: 'text is required.' });
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: input.text, preview_url: Boolean(input.previewUrl) }
      };
    }

    const store = getStore('whatsapp-outreach');
    const idempotencyKey = input.idempotencyKey || `${to}:${mode}:${Date.now()}`;
    const prior = await store.get(`send:${idempotencyKey}`, { type: 'json' }).catch(() => null);
    if (prior?.status === 'sent') return json(200, { ...prior, duplicatePrevented: true });

    const result = await metaRequest(`${phoneNumberId}/messages`, { method: 'POST', body: payload });
    const record = {
      status: 'sent',
      to,
      mode,
      eligibility,
      metaMessageId: result?.messages?.[0]?.id || null,
      sentAt: new Date().toISOString(),
      contactId: input.contactId || null
    };
    await store.setJSON(`send:${idempotencyKey}`, record);
    if (record.metaMessageId) await store.setJSON(`message:${record.metaMessageId}`, record);
    return json(200, record);
  } catch (error) {
    return json(error.status || 500, { error: error.message, details: error.data || null });
  }
};
