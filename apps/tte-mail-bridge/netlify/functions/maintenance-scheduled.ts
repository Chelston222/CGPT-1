import type { Config } from '@netlify/functions';
import { audit, store } from './_shared/store.mjs';

const DAY = 86_400_000;
const MAX_DELETES = 1200;

function ageMs(iso:string|undefined, now:number){
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? now - t : 0;
}

async function deleteBatch(keys:string[]){
  const s = store();
  for(let i=0;i<keys.length;i+=50) await Promise.all(keys.slice(i,i+50).map((key)=>s.delete(key)));
}

export default async()=>{
  const s=store(); const now=Date.now(); const remove:string[]=[];
  const queueRetentionDays=Math.max(30,Number(Netlify.env.get('TTE_QUEUE_TERMINAL_RETENTION_DAYS')||90));
  const sentRetentionDays=Math.max(7,Number(Netlify.env.get('TTE_SENT_COUNTER_RETENTION_DAYS')||35));
  const auditRetentionDays=Math.max(30,Number(Netlify.env.get('TTE_AUDIT_RETENTION_DAYS')||90));

  const terminalPrefixes=['queue/SENT/','queue/CANCELLED/','queue/BLOCKED/','queue/DELIVERY_UNKNOWN/'];
  for(const prefix of terminalPrefixes){
    const {blobs}=await s.list({prefix});
    for(const {key} of blobs){
      if(remove.length>=MAX_DELETES) break;
      const item=await s.get(key,{type:'json'}) as any;
      if(item && ageMs(item.updatedAt||item.sentAt||item.cancelledAt||item.createdAt,now)>queueRetentionDays*DAY) remove.push(key);
    }
  }

  const {blobs:oauth}=await s.list({prefix:'oauth-state/'});
  for(const {key} of oauth){
    if(remove.length>=MAX_DELETES) break;
    const item=await s.get(key,{type:'json'}) as any;
    if(item && ageMs(item.createdAt,now)>DAY) remove.push(key);
  }

  const sentCutoffDate=new Date(now-sentRetentionDays*DAY).toISOString().slice(0,10);
  for(const prefix of ['sent/account/','sent/global/','sent/domain/']){
    const {blobs}=await s.list({prefix});
    for(const {key} of blobs){
      if(remove.length>=MAX_DELETES) break;
      const match=key.match(/\/(\d{4}-\d{2}-\d{2})\//);
      if(match?.[1] && match[1]<sentCutoffDate) remove.push(key);
    }
  }

  const auditCutoffDate=new Date(now-auditRetentionDays*DAY).toISOString().slice(0,10);
  const {blobs:auditBlobs}=await s.list({prefix:'audit/'});
  for(const {key} of auditBlobs){
    if(remove.length>=MAX_DELETES) break;
    const match=key.match(/^audit\/(\d{4}-\d{2}-\d{2})\//);
    if(match?.[1] && match[1]<auditCutoffDate) remove.push(key);
  }

  const unique=[...new Set(remove)];
  await deleteBatch(unique);
  await audit('MAINTENANCE_COMPLETED',{deleted:unique.length,queueRetentionDays,sentRetentionDays,auditRetentionDays});
};

export const config:Config={schedule:'17 2 * * *'};
