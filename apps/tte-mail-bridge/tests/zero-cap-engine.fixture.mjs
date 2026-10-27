import { mock } from 'node:test';
import assert from 'node:assert/strict';

let providerCalls = 0;
let reservations = 0;
mock.module('nodemailer', {defaultExport:{createTransport:() => ({
  sendMail:async() => {providerCalls++; throw new Error('Provider must never be called');},
  close:() => {},
})}});
mock.module('../netlify/functions/_shared/store.mjs', {namedExports:{
  audit:async() => {},domainSentToday:async() => 0,getAccount:async() => null,
  getEmergencyStop:async() => ({stopped:false}),getIdempotency:async() => null,
  getLeadRoute:async() => null,getReplyMarker:async() => null,getSuppression:async() => null,
  getUsage:async() => ({}),globalSentToday:async() => 0,listAccounts:async() => [],
  recordFailure:async() => {},recordSent:async() => {},saveAccount:async() => {},
  setIdempotency:async() => {reservations++;},setLeadRoute:async() => {},
}});

const values = {TTE_SMTP_PASS:'synthetic-test-only',TTE_GLOBAL_DAILY_CAP:'100',TTE_DIRECT_DAILY_CAP:'10'};
globalThis.Netlify = {env:{get:name => values[name]}};
const {deliverApproved} = await import('../netlify/functions/_shared/engine.mjs');
const payload = {to:['nobody@example.invalid'],leadId:'SYNTHETIC-ZERO-CAP',touchNo:1,idempotencyKey:'SYNTHETIC-ZERO-CAP|1'};

for (const [name,code] of [
  ['TTE_GLOBAL_DAILY_CAP','GLOBAL_DAILY_CAP'],
  ['TTE_DIRECT_DAILY_CAP','NO_HEALTHY_SENDER'],
  ['TTE_SMTP_ROLLING_24H_CAP','NO_HEALTHY_SENDER'],
  ['TTE_DOMAIN_DAILY_CAP','RECIPIENT_DOMAIN_DAILY_CAP'],
]) {
  const prior = values[name];
  values[name] = '0';
  const result = await deliverApproved(payload);
  assert.equal(result.code,code,name);
  assert.equal(result.ok,false,name);
  if (prior === undefined) delete values[name]; else values[name] = prior;
}
assert.equal(providerCalls,0);
assert.equal(reservations,0);
console.log('FOUR_ZERO_CAP_PATHS_BLOCKED_BEFORE_PROVIDER_AND_RESERVATION');
