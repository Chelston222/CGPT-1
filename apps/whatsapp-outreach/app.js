const $ = (id) => document.getElementById(id);
const status = (text) => { $('status').textContent = text; };
const value = (id) => $(id).value.trim();

async function api(path, options = {}) {
  const res = await fetch(`/api/${path}`, { headers: { 'content-type': 'application/json', ...(options.headers || {}) }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function formData() {
  return {
    business: value('business'),
    contactName: value('contactName'),
    phone: value('phone'),
    linkedinUrl: value('linkedinUrl'),
    whatsappEligibility: $('eligibility').value,
    message: value('message'),
    pdfUrl: value('pdfUrl')
  };
}

async function refresh() {
  const { items } = await api('queue');
  $('queue').innerHTML = items.length ? items.map((item) => `
    <div class="item">
      <strong>${item.business || 'Unnamed business'}</strong>
      <div>${item.contactName || ''} ${item.phone ? `· ${item.phone}` : ''}</div>
      <div class="muted">${item.status} · WhatsApp: ${item.whatsappEligibility}</div>
    </div>`).join('') : '<div class="muted">Nothing queued yet.</div>';
}

$('save').addEventListener('click', async () => {
  try {
    status('Saving…');
    await api('queue', { method: 'POST', body: JSON.stringify({ ...formData(), status: 'ready' }) });
    status('Saved.');
    await refresh();
  } catch (error) { status(error.message); }
});

$('sendText').addEventListener('click', async () => {
  try {
    const item = formData();
    status('Sending text…');
    const result = await api('send', { method: 'POST', body: JSON.stringify({
      to: item.phone,
      mode: 'text',
      text: item.message,
      whatsappEligibility: item.whatsappEligibility,
      idempotencyKey: `${item.business}:${item.phone}:text:${new Date().toISOString().slice(0,10)}`
    }) });
    status(`Sent: ${result.metaMessageId || 'accepted'}`);
  } catch (error) { status(error.message); }
});

$('sendPdf').addEventListener('click', async () => {
  try {
    const item = formData();
    if (!item.pdfUrl) throw new Error('Add a public PDF URL first.');
    status('Sending PDF…');
    const result = await api('send', { method: 'POST', body: JSON.stringify({
      to: item.phone,
      mode: 'document',
      whatsappEligibility: item.whatsappEligibility,
      document: { link: item.pdfUrl, filename: `${item.business || 'Revenue Recovery'} - Revenue Recovery.pdf`, caption: item.message },
      idempotencyKey: `${item.business}:${item.phone}:pdf:${new Date().toISOString().slice(0,10)}`
    }) });
    status(`PDF sent: ${result.metaMessageId || 'accepted'}`);
  } catch (error) { status(error.message); }
});

refresh().catch((error) => status(error.message));
