import type { Config } from '@netlify/functions';
import { requireAuth } from './_shared/auth.mjs';
import { dispatchReady } from './_shared/queue-service.mjs';
import { jsonResponse } from './_shared/util.mjs';
export default async(req:Request)=>{
  const denied=requireAuth(req);if(denied)return denied;
  if(Netlify.env.get('TTE_ALLOW_MANUAL_DISPATCH')!=='true') return jsonResponse(409,{error:'manual_dispatch_disabled',detail:'Production queue is dispatched by the single scheduled worker to avoid concurrent sends.'});
  let body:any={};try{body=await req.json();}catch{}
  const result=await dispatchReady({max:Number(body.max||1),trigger:'manual-api'});return jsonResponse(200,result);
};
export const config:Config={path:'/api/tte/dispatch',method:['POST']};
