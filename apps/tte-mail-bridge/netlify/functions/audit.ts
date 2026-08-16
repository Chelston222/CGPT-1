import type { Config } from '@netlify/functions';
import { requireAuth } from './_shared/auth.mjs';
import { auditRecent } from './_shared/store.mjs';
import { jsonResponse } from './_shared/util.mjs';
export default async(req:Request)=>{const denied=requireAuth(req);if(denied)return denied;const limit=Math.min(200,Math.max(1,Number(new URL(req.url).searchParams.get('limit')||50)));return jsonResponse(200,{events:await auditRecent(limit)});};
export const config:Config={path:'/api/tte/audit',method:['GET']};
