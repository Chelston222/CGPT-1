import { DEFAULTS } from './constants.mjs';

// Zero is an intentional stop. A malformed explicit setting must also stop,
// rather than silently substituting a positive default or allowing NaN through.
export function deliveryCap(value, fallback, maximum) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' && typeof value !== 'string') return 0;
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return 0;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) return 0;
  return Math.min(maximum, n);
}

export function deliveryLimits(get) {
  return {
    globalDailyCap: deliveryCap(get('TTE_GLOBAL_DAILY_CAP'), DEFAULTS.globalDailyCap, 1000),
    smtpDailyCap: deliveryCap(get('TTE_DIRECT_DAILY_CAP'), DEFAULTS.legacySmtpDailyCap, 100),
    smtpRolling24hCap: deliveryCap(get('TTE_SMTP_ROLLING_24H_CAP'), DEFAULTS.legacySmtpDailyCap, 100),
    domainDailyCap: deliveryCap(get('TTE_DOMAIN_DAILY_CAP'), DEFAULTS.domainDailyCap, 100),
  };
}
