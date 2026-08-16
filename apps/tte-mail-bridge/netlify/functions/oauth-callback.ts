import type { Config } from '@netlify/functions';
import { encryptionKey, googleClientId, googleClientSecret } from './_shared/auth.mjs';
import { encryptJson, verifyState } from './_shared/crypto.mjs';
import { exchangeCode, getGoogleUserInfo } from './_shared/google.mjs';
import { audit, getAccount, resetFailureState, saveAccount, store } from './_shared/store.mjs';
import { shortHash } from './_shared/util.mjs';

function esc(value:unknown){return String(value ?? '').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c));}
function page(title:string, body:string, status=200) {
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title><style>body{font:16px system-ui;background:#07172b;color:#f4f7fb;padding:40px;max-width:720px;margin:auto}a{color:#67d5ff}.card{border:1px solid #21496f;padding:24px;border-radius:16px;background:#0c213b}</style></head><body><div class="card"><h1>${title}</h1>${body}<p><a href="/">Return to control centre</a></p></div></body></html>`,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
}
export default async (req:Request) => {
  const url = new URL(req.url); const code=url.searchParams.get('code'); const stateToken=url.searchParams.get('state'); const oauthError=url.searchParams.get('error');
  if (oauthError) return page('Google connection cancelled',`<p>${esc(oauthError)}</p>`,400);
  if (!code || !stateToken) return page('Connection failed','<p>Missing OAuth response parameters.</p>',400);
  try {
    const state = verifyState(stateToken, encryptionKey());
    const nonceKey=`oauth-state/${state.nonce}`; const nonce=await store().get(nonceKey,{type:'json'}) as any;
    if (!nonce) throw new Error('OAuth state was already used or expired');
    await store().delete(nonceKey);
    const redirectUri = `${url.origin}/api/tte/oauth/callback`;
    if (redirectUri !== state.redirectUri) throw new Error('OAuth redirect mismatch');
    const tokens = await exchangeCode({code,clientId:googleClientId(),clientSecret:googleClientSecret(),redirectUri});
    const user = await getGoogleUserInfo(tokens.access_token);
    if (user.email_verified === false) throw new Error('Google email is not verified');
    const email = String(user.email).toLowerCase(); const id=shortHash(email,24); const prior=await getAccount(id) as any;
    const refreshToken=tokens.refresh_token || (prior?.token ? null : undefined);
    const tokenEnvelope = refreshToken ? encryptJson({refreshToken},encryptionKey(),`gmail-token:${id}`) : prior?.token;
    if (!tokenEnvelope) throw new Error('No refresh token returned. Reconnect and grant consent again.');
    const nextStatus = !prior ? 'WARMING' : prior.status === 'PAUSED' ? 'PAUSED' : prior.status === 'QUARANTINED' ? 'QUARANTINED' : prior.status === 'WARMING' ? 'WARMING' : 'ACTIVE';
    const recoveredAuth = prior?.status === 'REAUTH_REQUIRED';
    const account={
      ...(prior||{}), id, provider:'gmail', email, senderName:prior?.senderName || 'Chelston Phillip', label:prior?.label || email, lane:prior?.lane || 'unassigned',
      recoveryStatus:prior?.recoveryStatus || 'UNKNOWN', recoveryEmail:prior?.recoveryEmail || null, recoveryPhoneLast4:prior?.recoveryPhoneLast4 || null, recoveryCheckedAt:prior?.recoveryCheckedAt || null,
      status:nextStatus, enabled:['ACTIVE','WARMING'].includes(nextStatus),
      token:tokenEnvelope, connectedAt:prior?.connectedAt || new Date().toISOString(), reauthorisedAt:prior ? new Date().toISOString() : null,
      dailyCap:Number(prior?.dailyCap || 10), rolling24hCap:Number(prior?.rolling24hCap || 15), minIntervalMinutes:Number(prior?.minIntervalMinutes || 6), priority:Number(prior?.priority || 0),
      warmup:prior?.warmup || {startedAt:new Date().toISOString(),startCap:5,step:2,stepEveryDays:3,maxCap:20}, health:{...(prior?.health||{}),score:Number(prior?.health?.score ?? 100),lastFailureCode:recoveredAuth?null:(prior?.health?.lastFailureCode||null)},
    };
    if(recoveredAuth) await resetFailureState(id);
    await saveAccount(account); await audit('GMAIL_ACCOUNT_CONNECTED',{accountId:id,emailHash:shortHash(email,48),reauthorised:Boolean(prior),recoveredAuth});
    return page('Gmail connected',`<p><strong>${esc(email)}</strong> is connected to the 222Emails sender pool.</p><p>Status: ${esc(account.status)}</p><p>Set its lane and recovery status in the control centre before relying on it.</p>`);
  } catch (err:any) {
    await audit('OAUTH_CALLBACK_FAILED',{code:err?.message || 'unknown'}).catch(()=>{});
    return page('Connection failed',`<p>${esc(err?.message || 'Unknown OAuth error')}</p>`,400);
  }
};
export const config: Config = { path:'/api/tte/oauth/callback', method:['GET'] };
