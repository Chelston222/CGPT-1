import type { Config } from '@netlify/functions';
import { requireAuth } from './_shared/auth.mjs';
import { getEmergencyStop, globalSentToday, listAccounts, listQueue, listSuppressions } from './_shared/store.mjs';
import { jsonResponse, withinLondonSendingWindow } from './_shared/util.mjs';

export default async(req:Request)=>{
  const denied=requireAuth(req);if(denied)return denied;
  const activeStates=['PENDING_REVIEW','READY','IN_FLIGHT','DELIVERY_UNKNOWN','BLOCKED'];
  const [accounts,queue,suppressions,emergency,sentToday]=await Promise.all([listAccounts(),listQueue(activeStates),listSuppressions(),getEmergencyStop(),globalSentToday()]);
  const states:any={};for(const q of queue)states[q.state]=(states[q.state]||0)+1;
  const start=Number(Netlify.env.get('TTE_SEND_START_HOUR')||8);const end=Number(Netlify.env.get('TTE_SEND_END_HOUR')||18);const windowEnabled=Netlify.env.get('TTE_SEND_WINDOW_ENABLED')!=='false';
  return jsonResponse(200,{sentToday,connectedAccounts:accounts.length,activeAccounts:accounts.filter((a:any)=>['ACTIVE','WARMING'].includes(a.status) && a.enabled !== false).length,queue:states,suppressions:suppressions.length,emergencyStop:emergency.stopped,deliveryWindow:{enabled:windowEnabled,startHour:start,endHour:end,open:!windowEnabled||withinLondonSendingWindow(new Date(),start,end),timezone:'Europe/London'}});
};
export const config:Config={path:'/api/tte/metrics',method:['GET']};
