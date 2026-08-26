import fs from 'node:fs';
import path from 'node:path';
import { screenPhone, providerStatus } from './check.mjs';

const root = path.dirname(new URL(import.meta.url).pathname);
const queuePath = path.join(root, 'state', 'queue.json');
const resultsPath = path.join(root, 'state', 'results.jsonl');

const maxChecks = Number(process.env.TPS_MAX_CHECKS_PER_RUN || 10);
const provider = process.env.TPS_PROVIDER || 'tpscheck';

const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
const pending = queue.filter(x => x.status === 'PENDING');

const status = await providerStatus();
if (!status[provider]?.enabled) {
  console.log(JSON.stringify({ state: 'HUMAN_REQUIRED', provider, reason: status[provider]?.reason || 'API credential missing', provider_status: status }, null, 2));
  process.exit(0);
}

let remaining = maxChecks;
if (provider === 'tpscheck' && status.tpscheck?.credits?.requests_remaining !== undefined) {
  remaining = Math.min(remaining, Number(status.tpscheck.credits.requests_remaining));
}

if (remaining <= 0) {
  console.log(JSON.stringify({ state: 'NO_CREDITS', provider, provider_status: status }, null, 2));
  process.exit(0);
}

const batch = pending.slice(0, remaining);
const completed = [];

for (const item of batch) {
  try {
    const result = await screenPhone(item.phone, provider);
    const disposition = result.valid === false ? 'INVALID' : (result.tps || result.ctps ? 'REGISTERED_DO_NOT_CALL' : 'CLEAR_TO_CALL');
    const audit = { ...item, ...result, disposition };
    fs.appendFileSync(resultsPath, JSON.stringify(audit) + '\n');
    item.status = 'SCREENED';
    item.screening = {
      provider: result.provider,
      checked_at: result.checked_at,
      tps: result.tps,
      ctps: result.ctps,
      valid: result.valid,
      disposition
    };
    completed.push({ lead_id: item.lead_id, phone: item.phone, disposition, tps: result.tps, ctps: result.ctps });
  } catch (error) {
    if (error.status === 429) break;
    fs.appendFileSync(resultsPath, JSON.stringify({ ...item, provider, checked_at: new Date().toISOString(), disposition: 'ERROR', error: error.message }) + '\n');
  }
}

fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2) + '\n');
console.log(JSON.stringify({ state: 'COMPLETE', provider, checked: completed.length, completed, provider_status_before: status }, null, 2));
