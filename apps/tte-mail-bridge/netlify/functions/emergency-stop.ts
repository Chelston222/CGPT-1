import type { Config } from '@netlify/functions';
import { requireAuth } from './_shared/auth.mjs';
import { audit, getEmergencyStop, setEmergencyStop } from './_shared/store.mjs';
import { jsonResponse } from './_shared/util.mjs';
export default async(req:Request)=>{const denied=requireAuth(req);if(denied)return denied;if(req.method==='GET')return jsonResponse(200,await getEmergencyStop());let body:any={};try{body=await req.json();}catch{return jsonResponse(400,{error:'invalid_json'});}if(typeof body.stopped!=='boolean')return jsonResponse(400,{error:'stopped_boolean_required'});const state=await setEmergencyStop(body.stopped,body.reason,body.actor);await audit(body.stopped?'EMERGENCY_STOP_ENABLED':'EMERGENCY_STOP_DISABLED',{actor:String(body.actor||''),reason:String(body.reason||'')});return jsonResponse(200,state);};
export const config:Config={path:'/api/tte/emergency-stop',method:['GET','POST']};
