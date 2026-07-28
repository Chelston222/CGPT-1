import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';
export const json=(statusCode,body,headers={})=>({statusCode,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers},body:JSON.stringify(body)});
export const parseBody=e=>{try{return e.body?JSON.parse(e.body):{}}catch{throw new Error('INVALID_JSON')}};
export const store=()=>getStore({name:'harper-os',consistency:'strong'});export const now=()=>new Date().toISOString();export const id=()=>crypto.randomUUID();export const normalisePhone=(v='')=>String(v).replace(/[^+\d]/g,'');
export async function readList(k){return(await store().get(k,{type:'json'}))||[]}export async function writeList(k,v){await store().setJSON(k,v)}
export function requireAdmin(e){const x=process.env.HARPER_ADMIN_TOKEN;if(!x)throw new Error('ADMIN_NOT_CONFIGURED');const s=e.headers?.authorization?.replace(/^Bearer\s+/i,'')||'';if(s.length!==x.length||!crypto.timingSafeEqual(Buffer.from(s),Buffer.from(x)))throw new Error('UNAUTHORISED')}
export function verifyRetell(e){const s=process.env.RETELL_WEBHOOK_SECRET;if(!s)throw new Error('WEBHOOK_NOT_CONFIGURED');const sig=e.headers?.['x-retell-signature'];if(!sig)throw new Error('MISSING_SIGNATURE');const exp=crypto.createHmac('sha256',s).update(e.body||'').digest('hex');const a=Buffer.from(String(sig)),b=Buffer.from(exp);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))throw new Error('INVALID_SIGNATURE')}
export async function isSuppressed(phone){const p=normalisePhone(phone),l=await readList('suppressions');return l.some(x=>normalisePhone(x.phone||x.value)===p)}
export const errorResponse=e=>{const c=e?.message||'INTERNAL_ERROR';const s=({UNAUTHORISED:401,ADMIN_NOT_CONFIGURED:503,INVALID_JSON:400,INVALID_SIGNATURE:401,MISSING_SIGNATURE:401,WEBHOOK_NOT_CONFIGURED:503,SUPPRESSED:409,NOT_APPROVED:409,MISSING_FIELDS:400}[c]||500);return json(s,{ok:false,error:c})};
