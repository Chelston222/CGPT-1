'use strict';

const ALLOWED_TARGETS = new Set(['personal', 'main', 'secondary']);
const CONFIG_START = '<!-- INTAKE_CONFIG_START -->';
const CONFIG_END = '<!-- INTAKE_CONFIG_END -->';
const EXPECTED_SENDER = 'tripletwochelston@gmail.com';
const SUBJECT_PREFIX = 'TTE LINKEDIN PDF INTAKE ';
const EXPLICIT_ZONE_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const MAX_SCHEDULE_HORIZON_MS = 90 * 24 * 60 * 60 * 1000;
const RESERVED_COPY_MARKER = /^---(?:PERSONAL|MAIN|SECONDARY)---$/mi;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertHeaderSafe(value, fieldName, maxLength = 240) {
  const text = String(value || '').trim();
  assert(text.length > 0 && text.length <= maxLength, `${fieldName} must be 1-${maxLength} characters.`);
  assert(!/[\r\n\u0000-\u001f\u007f]/.test(text), `${fieldName} must be a single header-safe line with no control characters.`);
  return text;
}

function parseIntakeIssue(title, body, nowMs = Date.now()) {
  const prefix = '[IMAP PDF INTAKE] ';
  assert(String(title || '').startsWith(prefix), `Issue title must start with ${prefix}`);
  const titleId = String(title).slice(prefix.length).trim();
  assert(/^[a-z0-9][a-z0-9-]{2,79}$/i.test(titleId), 'Issue title contains an invalid intake ID.');

  const text = String(body || '');
  const firstStart = text.indexOf(CONFIG_START);
  const firstEnd = text.indexOf(CONFIG_END);
  assert(firstStart >= 0 && firstEnd > firstStart, 'Issue body must contain one locked intake config block.');
  assert(text.indexOf(CONFIG_START, firstStart + CONFIG_START.length) === -1, 'Issue body must contain exactly one intake config start marker.');
  assert(text.indexOf(CONFIG_END, firstEnd + CONFIG_END.length) === -1, 'Issue body must contain exactly one intake config end marker.');
  const raw = text.slice(firstStart + CONFIG_START.length, firstEnd).trim();
  assert(raw.length > 0 && raw.length <= 30000, 'Intake config block is empty or too large.');

  let config;
  try {
    config = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Intake config is not valid JSON: ${error.message}`);
  }

  const id = String(config.id || '').trim();
  assert(id === titleId, 'Issue-title intake ID must exactly match config.id.');
  assert(/^[a-z0-9][a-z0-9-]{2,79}$/i.test(id), 'config.id is invalid.');

  const expectedSubject = String(config.expectedSubject || '').trim();
  assert(expectedSubject === `${SUBJECT_PREFIX}${id}`, `expectedSubject must be exactly ${SUBJECT_PREFIX}${id}.`);
  assert(String(config.expectedSender || '').trim().toLowerCase() === EXPECTED_SENDER, `expectedSender must be ${EXPECTED_SENDER}.`);

  const expectedFilename = String(config.expectedFilename || '').trim();
  assert(expectedFilename.length >= 5 && expectedFilename.length <= 184 && /\.pdf$/i.test(expectedFilename), 'expectedFilename must be a PDF filename under 185 characters.');
  assert(!/[\\/\u0000-\u001f\u007f]/.test(expectedFilename), 'expectedFilename must be a plain filename with no path separators or control characters.');

  assert(/^[a-f0-9]{64}$/.test(String(config.expectedSha256 || '').toLowerCase()), 'expectedSha256 must be a SHA-256 digest.');

  const expectedBytes = Number(config.expectedBytes);
  const expectedPages = Number(config.expectedPages);
  assert(Number.isSafeInteger(expectedBytes) && expectedBytes >= 1 && expectedBytes <= 100000000, 'expectedBytes must be 1-100000000.');
  assert(Number.isSafeInteger(expectedPages) && expectedPages >= 1 && expectedPages <= 300, 'expectedPages must be 1-300.');

  const manifest = config.manifest;
  assert(manifest && typeof manifest === 'object' && !Array.isArray(manifest), 'manifest object is required.');
  assert(manifest.schemaVersion === 1, 'manifest.schemaVersion must be exactly 1.');
  assert(String(manifest.id || '') === id, 'manifest.id must match config.id.');
  assert(Number.isSafeInteger(manifest.revision) && manifest.revision >= 1, 'manifest.revision must be an explicit positive integer.');
  manifest.title = assertHeaderSafe(manifest.title, 'manifest.title');
  manifest.documentTitle = assertHeaderSafe(manifest.documentTitle, 'manifest.documentTitle');
  if (manifest.category != null) {
    assert(/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(String(manifest.category)), 'manifest.category must be a header-safe slug.');
  }
  if (manifest.funnelStage != null) {
    assert(/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(String(manifest.funnelStage)), 'manifest.funnelStage must be a header-safe slug.');
  }

  assert(manifest.copy && typeof manifest.copy === 'object' && !Array.isArray(manifest.copy), 'manifest.copy object is required.');
  const copyKeys = Object.keys(manifest.copy);
  assert(copyKeys.length === 1 && copyKeys[0] === 'default', 'Canonical IMAP PDF intake requires copy.default as the only copy variant.');
  const defaultCopy = String(manifest.copy.default || '').trim();
  assert(defaultCopy.length > 0 && defaultCopy.length <= 3000, 'manifest.copy.default must be 1-3000 characters.');
  assert(!defaultCopy.includes('\u2014'), 'manifest.copy.default must not contain em dashes.');
  assert(!RESERVED_COPY_MARKER.test(defaultCopy), 'manifest.copy.default must not contain reserved LinkedIn target section markers.');

  assert(Array.isArray(manifest.targets) && manifest.targets.length === 1, 'Canonical IMAP PDF intake requires exactly one target.');
  assert(manifest.targets.every((target) => ALLOWED_TARGETS.has(target)), 'manifest.targets contains an unsupported target.');
  assert((manifest.mode || 'draft') === 'schedule', 'Reusable IMAP intake currently requires mode=schedule.');
  assert(manifest.publicMediaApproved === true, 'manifest.publicMediaApproved must be true because the governed Buffer media URL is publicly reachable before publication.');
  assert(manifest.publicReleaseMaterialApproved === true, 'manifest.publicReleaseMaterialApproved must be true because the public repository issue and queue expose the locked caption, schedule and release metadata before publication.');
  assert(String(manifest.expectedSha256 || '').toLowerCase() === String(config.expectedSha256).toLowerCase(), 'manifest.expectedSha256 must match expectedSha256.');
  assert(!manifest.downloadUrl, 'IMAP intake must not provide manifest.downloadUrl.');
  assert(!manifest.chunks, 'Issue config must not provide manifest.chunks; the verified attachment creates them.');

  assert(manifest.scheduledAt && typeof manifest.scheduledAt === 'object' && !Array.isArray(manifest.scheduledAt), 'manifest.scheduledAt is required.');
  const scheduleKeys = Object.keys(manifest.scheduledAt);
  assert(scheduleKeys.length === 1 && scheduleKeys[0] === manifest.targets[0], 'Canonical IMAP PDF intake requires exactly one schedule key matching the single target.');
  for (const target of manifest.targets) {
    const scheduled = String(manifest.scheduledAt[target] || '').trim();
    assert(EXPLICIT_ZONE_ISO.test(scheduled), `manifest.scheduledAt.${target} must be ISO 8601 with an explicit Z or UTC offset.`);
    const timestamp = Date.parse(scheduled);
    assert(Number.isFinite(timestamp), `manifest.scheduledAt.${target} must be a valid ISO date/time.`);
    assert(timestamp > nowMs + 10 * 60 * 1000, `manifest.scheduledAt.${target} must be more than 10 minutes in the future.`);
    assert(timestamp <= nowMs + MAX_SCHEDULE_HORIZON_MS, `manifest.scheduledAt.${target} must be within 90 days so the current 120-day publication verifier horizon cannot lose the approval before due time.`);
  }

  const sourceUrl = String(manifest.sourceUrl || '').trim();
  assert(/^https:\/\/(?:www\.)?(?:notion\.so|app\.notion\.com)\//i.test(sourceUrl), 'manifest.sourceUrl must be a Notion page URL for live quality gating.');
  assert(/(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\?|$|\/)/i.test(sourceUrl), 'manifest.sourceUrl must contain a concrete Notion page ID.');

  return {
    id,
    expectedSubject,
    expectedSender: EXPECTED_SENDER,
    expectedFilename,
    expectedSha256: String(config.expectedSha256).toLowerCase(),
    expectedBytes,
    expectedPages,
    revision: manifest.revision,
    manifest: { ...manifest, schemaVersion: 1, id, expectedSha256: String(config.expectedSha256).toLowerCase() },
  };
}

module.exports = {
  ALLOWED_TARGETS,
  CONFIG_START,
  CONFIG_END,
  EXPECTED_SENDER,
  EXPLICIT_ZONE_ISO,
  MAX_SCHEDULE_HORIZON_MS,
  RESERVED_COPY_MARKER,
  SUBJECT_PREFIX,
  assertHeaderSafe,
  parseIntakeIssue,
};
