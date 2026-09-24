import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

export default async () => {
  const configured = Boolean(await getStore('linkedin-private-ops-credential-broker').get('buffer-credentials-v1.enc.json', { type: 'text' }));
  return new Response(JSON.stringify({ service: 'linkedin-provider-bridge', configured }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
};

export const config: Config = { path: '/api/health', method: ['GET'] };
