import { getStore } from '@netlify/blobs';
import { json, normalizePhone } from './_meta.mjs';

const allowedStatuses = new Set(['draft', 'ready', 'approved', 'sent', 'replied', 'hold', 'failed']);

export default async (request) => {
  const store = getStore('whatsapp-outreach');

  if (request.method === 'GET') {
    const { blobs } = await store.list({ prefix: 'queue:' });
    const items = [];
    for (const blob of blobs) {
      const item = await store.get(blob.key, { type: 'json' }).catch(() => null);
      if (item) items.push(item);
    }
    items.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    return json(200, { items });
  }

  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const input = await request.json();
    const id = input.id || crypto.randomUUID();
    const existing = await store.get(`queue:${id}`, { type: 'json' }).catch(() => null);
    const status = String(input.status || existing?.status || 'draft').toLowerCase();
    if (!allowedStatuses.has(status)) return json(400, { error: 'Invalid status.' });

    const item = {
      id,
      business: input.business ?? existing?.business ?? '',
      contactName: input.contactName ?? existing?.contactName ?? '',
      phone: input.phone ? normalizePhone(input.phone) : existing?.phone || '',
      linkedinUrl: input.linkedinUrl ?? existing?.linkedinUrl ?? '',
      whatsappEligibility: input.whatsappEligibility ?? existing?.whatsappEligibility ?? 'unknown',
      eligibilitySource: input.eligibilitySource ?? existing?.eligibilitySource ?? '',
      templateName: input.templateName ?? existing?.templateName ?? '',
      message: input.message ?? existing?.message ?? '',
      pdfUrl: input.pdfUrl ?? existing?.pdfUrl ?? '',
      status,
      notes: input.notes ?? existing?.notes ?? '',
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await store.setJSON(`queue:${id}`, item);
    return json(200, item);
  } catch (error) {
    return json(500, { error: error.message });
  }
};
