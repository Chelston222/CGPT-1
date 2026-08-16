import { OAUTH_SCOPES } from './constants.mjs';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

async function readJson(res) { const text = await res.text(); try { return JSON.parse(text); } catch { return { raw: text }; } }
export function buildGoogleAuthorizationUrl({ clientId, redirectUri, state }) {
  const p = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: OAUTH_SCOPES.join(' '), access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state });
  return `${AUTH_URL}?${p.toString()}`;
}
export async function exchangeCode({ code, clientId, clientSecret, redirectUri }) {
  const res = await fetch(TOKEN_URL, { method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({ code, client_id:clientId, client_secret:clientSecret, redirect_uri:redirectUri, grant_type:'authorization_code' }) });
  const data = await readJson(res);
  if (!res.ok) throw Object.assign(new Error('google_oauth_exchange_failed'), { status:res.status, data });
  return data;
}
export async function refreshAccessToken({ refreshToken, clientId, clientSecret }) {
  let res;
  try {
    res = await fetch(TOKEN_URL, { method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({ refresh_token:refreshToken, client_id:clientId, client_secret:clientSecret, grant_type:'refresh_token' }) });
  } catch (cause) {
    // No Gmail send request has occurred yet, so this failure is safe to retry.
    throw Object.assign(new Error('google_token_refresh_transport_failed'), { safeRetry:true, code:'TOKEN_REFRESH_TRANSPORT', cause });
  }
  const data = await readJson(res);
  if (!res.ok) {
    if (data?.error === 'invalid_grant') throw Object.assign(new Error('reauth_required'), { status:res.status, data, code:data?.error });
    const safeRetry = res.status === 429 || res.status >= 500;
    throw Object.assign(new Error('google_token_refresh_failed'), { status:res.status, data, code:data?.error || 'TOKEN_REFRESH_FAILED', safeRetry });
  }
  if (!data.access_token) throw Object.assign(new Error('google_token_refresh_missing_access_token'), { safeRetry:true, code:'TOKEN_REFRESH_EMPTY' });
  return data.access_token;
}
export async function getGoogleUserInfo(accessToken) {
  const res = await fetch(USERINFO_URL, { headers:{authorization:`Bearer ${accessToken}`} }); const data = await readJson(res);
  if (!res.ok || !data.email) throw Object.assign(new Error('google_userinfo_failed'), { status:res.status, data });
  return data;
}
export async function revokeGoogleToken(token) {
  if (!token) return;
  await fetch(REVOKE_URL, { method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({ token }) });
}
export async function sendGmail({ accessToken, raw, threadId }) {
  let res;
  try {
    res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method:'POST', headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'}, body:JSON.stringify({ raw, ...(threadId ? { threadId } : {}) }) });
  } catch (cause) {
    throw Object.assign(new Error('gmail_delivery_unknown'), { deliveryUnknown:true, cause });
  }
  const data = await readJson(res);
  if (!res.ok) {
    const reason = data?.error?.errors?.[0]?.reason || data?.error?.status || 'gmail_send_rejected';
    const err = Object.assign(new Error('gmail_send_rejected'), { status:res.status, reason, data, deliveryUnknown: res.status >= 500 });
    throw err;
  }
  return data;
}
