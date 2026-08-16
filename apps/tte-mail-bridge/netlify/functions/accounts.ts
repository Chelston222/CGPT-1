import type { Config } from '@netlify/functions';
import { decryptionKeys, requireAuth } from './_shared/auth.mjs';
import { decryptJsonAny } from './_shared/crypto.mjs';
import { revokeGoogleToken } from './_shared/google.mjs';
import { effectiveDailyCap } from './_shared/routing.mjs';
import { audit, deleteAccount, getAccount, getUsage, listAccounts, resetFailureState, saveAccount } from './_shared/store.mjs';
import { jsonResponse, safeText } from './_shared/util.mjs';
import { validateEmail } from './_shared/validation.mjs';

const RECOVERY_STATES = new Set(['UNKNOWN','VERIFIED','ACTION_REQUIRED']);

export default async (req:Request) => {
  const denied=requireAuth(req); if(denied)return denied;
  if(req.method==='GET'){
    const rows=[]; for(const raw of await listAccounts()){ const {_key,token,...a}:any=raw; const usage=await getUsage(a,'nobody@example.invalid'); rows.push({...a,effectiveDailyCap:effectiveDailyCap(a),usage}); }
    if(Netlify.env.get('TTE_SMTP_PASS')) rows.unshift({id:'legacy-smtp',provider:'smtp',email:Netlify.env.get('TTE_SMTP_USER')||'hello@222emails.com',label:'Legacy SMTP',lane:'legacy',recoveryStatus:'N/A',status:'ACTIVE',enabled:true,dailyCap:Number(Netlify.env.get('TTE_DIRECT_DAILY_CAP')||20),virtual:true});
    return jsonResponse(200,{accounts:rows});
  }
  let body:any={}; try{body=await req.json();}catch{return jsonResponse(400,{error:'invalid_json'});} const id=String(body.id||'');
  if(!id || id==='legacy-smtp') return jsonResponse(400,{error:'gmail_account_id_required'});
  const account:any=await getAccount(id); if(!account)return jsonResponse(404,{error:'account_not_found'});
  const action=String(body.action||'update');
  if(action==='disconnect'){
    try{const token=decryptJsonAny(account.token,decryptionKeys(),`gmail-token:${id}`); await revokeGoogleToken(token.refreshToken);}catch{}
    await deleteAccount(id); await audit('GMAIL_ACCOUNT_DISCONNECTED',{accountId:id}); return jsonResponse(200,{ok:true,state:'DISCONNECTED'});
  }
  if(action==='pause'){account.status='PAUSED';account.enabled=false;}
  else if(action==='resume'){if(account.status==='REAUTH_REQUIRED')return jsonResponse(409,{error:'reauthorisation_required'});account.status='ACTIVE';account.enabled=true;account.cooldownUntil=null;account.quarantinedUntil=null;await resetFailureState(id);account.health={...(account.health||{}),consecutiveFailures:0,lastFailureCode:null,recoveredAt:new Date().toISOString()};}
  else if(action==='update'){
    if(body.senderName!==undefined)account.senderName=safeText(body.senderName,80)||'Chelston Phillip';
    if(body.label!==undefined)account.label=safeText(body.label,80)||account.email;
    if(body.lane!==undefined)account.lane=safeText(body.lane,60)||'unassigned';
    if(body.dailyCap!==undefined)account.dailyCap=Math.min(50,Math.max(1,Number(body.dailyCap)||10));
    if(body.rolling24hCap!==undefined)account.rolling24hCap=Math.min(75,Math.max(1,Number(body.rolling24hCap)||15));
    if(body.minIntervalMinutes!==undefined)account.minIntervalMinutes=Math.min(120,Math.max(1,Number(body.minIntervalMinutes)||6));
    if(body.priority!==undefined)account.priority=Math.min(100,Math.max(-100,Number(body.priority)||0));
    if(body.recoveryStatus!==undefined){
      const recoveryStatus=String(body.recoveryStatus||'').toUpperCase();
      if(!RECOVERY_STATES.has(recoveryStatus))return jsonResponse(400,{error:'invalid_recovery_status'});
      account.recoveryStatus=recoveryStatus;
      account.recoveryCheckedAt=recoveryStatus==='VERIFIED'?new Date().toISOString():null;
    }
    if(body.recoveryEmail!==undefined){
      const raw=String(body.recoveryEmail||'').trim();
      if(raw){const email=validateEmail(raw);if(!email)return jsonResponse(400,{error:'invalid_recovery_email'});account.recoveryEmail=email;}else account.recoveryEmail=null;
    }
    if(body.recoveryPhoneLast4!==undefined){
      const last4=String(body.recoveryPhoneLast4||'').trim();
      if(last4 && !/^\d{4}$/.test(last4))return jsonResponse(400,{error:'recovery_phone_last4_must_be_four_digits'});
      account.recoveryPhoneLast4=last4||null;
    }
  } else return jsonResponse(400,{error:'unsupported_action'});
  await saveAccount(account); await audit('GMAIL_ACCOUNT_UPDATED',{accountId:id,action,lane:account.lane||'unassigned',recoveryStatus:account.recoveryStatus||'UNKNOWN'}); const {token,...safe}:any=account; return jsonResponse(200,{ok:true,account:safe});
};
export const config: Config = { path:'/api/tte/accounts', method:['GET','POST'] };
