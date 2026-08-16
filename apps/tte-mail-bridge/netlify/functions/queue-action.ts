import type { Config } from '@netlify/functions';
import { requireAuth } from './_shared/auth.mjs';
import { queueAction } from './_shared/queue-service.mjs';
import { jsonResponse } from './_shared/util.mjs';
export default async(req:Request)=>{const denied=requireAuth(req);if(denied)return denied;let body:any;try{body=await req.json();}catch{return jsonResponse(400,{error:'invalid_json'});}const actor=String(body.actor||'').trim();if(!actor)return jsonResponse(400,{error:'actor_required'});const result=await queueAction({id:String(body.id||''),action:String(body.action||''),actor});return jsonResponse(result.status,result);};
export const config:Config={path:'/api/tte/queue/action',method:['POST']};
