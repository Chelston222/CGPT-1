export const VERSION = '2.0.0-apex';
export const STORE_NAME = 'tte-mail-bridge';
export const OAUTH_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.send',
];
export const REQUIRED_OPT_OUT = "If you'd rather I didn't follow up, just let me know.";
export const DEFAULTS = Object.freeze({
  globalDailyCap: 100,
  gmailDailyCap: 10,
  legacySmtpDailyCap: 20,
  rolling24hCap: 15,
  domainDailyCap: 4,
  minIntervalMinutes: 6,
  queueBatchSize: Number(5),
  queueMaxSize: 500,
  subjectMax: 180,
  bodyMax: 12000,
  warmupStartCap: 5,
  warmupStep: 2,
  warmupStepEveryDays: 3,
  warmupMaxCap: 20,
  authFailureQuarantineHours: 24,
  providerFailureCooldownMinutes: 60,
  staleInFlightMinutes: 20,
});
export const ACCOUNT_STATUSES = new Set([
  'WARMING', 'ACTIVE', 'PAUSED', 'QUARANTINED', 'REAUTH_REQUIRED', 'DISCONNECTED',
]);
export const QUEUE_STATES = new Set([
  'PENDING_REVIEW', 'READY', 'IN_FLIGHT', 'SENT', 'FAILED', 'DELIVERY_UNKNOWN', 'CANCELLED', 'BLOCKED',
]);
export const CORPORATE_TYPES = new Set(['corporate', 'limited_company', 'llp', 'plc', 'public_body']);
export const INDIVIDUALISH_TYPES = new Set(['sole_trader', 'individual', 'some_partnership']);
export const PROVIDER_PERMISSION_BASES = new Set([
  'consent',
  'soft_opt_in',
  'inbound_enquiry',
  'existing_relationship_requested',
  'existing_customer_operational',
  'internal_test',
]);
