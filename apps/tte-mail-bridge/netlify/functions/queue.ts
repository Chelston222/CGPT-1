import type { Config } from '@netlify/functions';
import { requireAuth } from './_shared/auth.mjs';
import { enqueueOutbound, queueView } from './_shared/queue-service.mjs';
import { jsonResponse } from './_shared/util.mjs';
export default async(req:Request)=>{const denied=requireAuth(req);if(denied)return denied;if(req.method==='GET'){const states=(new URL(req.url).searchParams.get('states')||'PENDING_REVIEW,READY,DELIVERY_UNKNOWN').split(',').filter(Boolean);return jsonResponse(200,{items:await queueView(states)});}let body:any;try{body=await req.json();}catch{return jsonResponse(400,{error:'invalid_json'});}const result=await enqueueOutbound(body);return jsonResponse(result.status,result);};
export const config:Config={path:'/api/tte/queue',method:['GET','POST']};
