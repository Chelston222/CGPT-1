import type { Config } from '@netlify/functions';
import { encryptionKey, googleClientId, requireAuth } from './_shared/auth.mjs';
import { signState } from './_shared/crypto.mjs';
import { buildGoogleAuthorizationUrl } from './_shared/google.mjs';
import { store } from './_shared/store.mjs';
import { jsonResponse, randomId } from './_shared/util.mjs';

export default async (req:Request) => {
  const denied = requireAuth(req); if (denied) return denied;
  if (!googleClientId()) return jsonResponse(503,{error:'google_oauth_not_configured'});
  const nonce = randomId('oauth');
  const redirectUri = `${new URL(req.url).origin}/api/tte/oauth/callback`;
  await store().setJSON(`oauth-state/${nonce}`, { createdAt:new Date().toISOString(), redirectUri });
  const state = signState({ nonce, exp:Date.now()+10*60*1000, redirectUri }, encryptionKey());
  return jsonResponse(200,{ authorizationUrl:buildGoogleAuthorizationUrl({clientId:googleClientId(),redirectUri,state}), redirectUri });
};
export const config: Config = { path:'/api/tte/oauth/start', method:['POST'] };
