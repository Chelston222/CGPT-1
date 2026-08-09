import { getLastEventMeta } from './_shared/store.mjs';

export default async () => {
  const configured = {
    payhip_api_key: Boolean(Netlify.env.get('PAYHIP_API_KEY')),
    control_api_token: Boolean(Netlify.env.get('CONTROL_API_TOKEN')),
    ops_forwarder: Boolean(Netlify.env.get('OPS_FORWARD_WEBHOOK_URL')),
  };
  let lastEvent = null;
  try { lastEvent = await getLastEventMeta(); } catch { /* store may be empty before first event */ }
  return Response.json({ service: '222emails-payhip-control', ok: true, configured, last_event: lastEvent }, {
    headers: { 'cache-control': 'no-store' },
  });
};

export const config = { path: '/api/health' };
