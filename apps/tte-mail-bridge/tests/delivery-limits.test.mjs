import test from 'node:test';
import assert from 'node:assert/strict';
import { deliveryCap, deliveryLimits } from '../netlify/functions/_shared/delivery-limits.mjs';
import { accountEligibility } from '../netlify/functions/_shared/routing.mjs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('real delivery engine blocks all four zero-cap paths before provider or reservation', () => {
  const output = execFileSync(process.execPath,['--experimental-test-module-mocks',
    fileURLToPath(new URL('./zero-cap-engine.fixture.mjs',import.meta.url))],{encoding:'utf8',timeout:10000});
  assert.match(output,/FOUR_ZERO_CAP_PATHS_BLOCKED_BEFORE_PROVIDER_AND_RESERVATION/);
});

test('an explicit zero stops global, SMTP, rolling and domain limits', () => {
  const limits = deliveryLimits(() => '0');
  assert.deepEqual(limits, {globalDailyCap:0, smtpDailyCap:0, smtpRolling24hCap:0, domainDailyCap:0});
  // The delivery comparison must block even before the first message today.
  assert.equal(0 >= limits.globalDailyCap, true);
  assert.equal(0 >= limits.domainDailyCap, true);
});

test('zero SMTP daily cap makes an otherwise healthy sender ineligible', () => {
  const limits = deliveryLimits(() => '0');
  const result = accountEligibility({id:'internal-fixture',status:'ACTIVE',enabled:true,
    dailyCap:limits.smtpDailyCap,rolling24hCap:20,minIntervalMinutes:0}, {});
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes('daily_cap'));
});

test('zero SMTP rolling cap makes an otherwise healthy sender ineligible', () => {
  const result = accountEligibility({id:'internal-fixture',status:'ACTIVE',enabled:true,
    dailyCap:20,rolling24hCap:deliveryLimits(() => '0').smtpRolling24hCap,minIntervalMinutes:0}, {});
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes('rolling_24h_cap'));
});

test('absent settings preserve existing defaults; configured limits remain independent', () => {
  assert.deepEqual(deliveryLimits(() => undefined), {globalDailyCap:100,smtpDailyCap:20,smtpRolling24hCap:20,domainDailyCap:4});
  const settings = {TTE_GLOBAL_DAILY_CAP:'0',TTE_DIRECT_DAILY_CAP:'7'};
  const limits = deliveryLimits(name => settings[name]);
  assert.equal(limits.globalDailyCap,0);
  assert.equal(limits.smtpDailyCap,7);
});

for (const value of ['', ' ', 'invalid', 'NaN', 'Infinity', '-1', '0.5', '1e2', '0x10', true, {}, NaN, Infinity, -1, 1.5]) {
  test(`malformed configured cap fails closed: ${String(value)}`, () => {
    assert.equal(deliveryCap(value,100,1000),0);
  });
}

test('valid positive integer limits are retained and bounded', () => {
  assert.equal(deliveryCap(' 12 ',100,1000),12);
  assert.equal(deliveryCap(12,100,1000),12);
  assert.equal(deliveryCap('9999',100,1000),1000);
  assert.equal(deliveryCap(undefined,100,1000),100);
});
