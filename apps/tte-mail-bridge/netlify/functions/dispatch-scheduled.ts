import type { Config } from '@netlify/functions';
import { dispatchReady } from './_shared/queue-service.mjs';
export default async()=>{
  if(Netlify.env.get('TTE_SCHEDULED_DISPATCH')==='false') return;
  await dispatchReady({max:Number(Netlify.env.get('TTE_DISPATCH_BATCH_SIZE')||1),trigger:'netlify-schedule'});
};
export const config:Config={schedule:'*/2 * * * *'};
