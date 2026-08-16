import type { Config } from '@netlify/functions';
import { requireAuth } from './_shared/auth.mjs';
import { enqueueOutbound } from './_shared/queue-service.mjs';
import { jsonResponse } from './_shared/util.mjs';

export default async(req:Request)=>{
  const denied=requireAuth(req);if(denied)return denied;
  let body:any;try{body=await req.json();}catch{return jsonResponse(400,{error:'invalid_json'});}
  const result=await enqueueOutbound(body);
  return jsonResponse(result.status,{...result,deliveryMode:'queued'});
};
export const config:Config={path:'/api/tte/send',method:['POST']};
