'use strict';

const ALLOWED_TARGETS = new Set(['personal', 'main', 'secondary']);
const CONFIG_START = '<!-- INTAKE_CONFIG_START -->';
const CONFIG_END = '<!-- INTAKE_CONFIG_END -->';
const EXPECTED_SENDER = 'tripletwochelston@gmail.com';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseIntakeIssue(title, body, nowMs = Date.now()) {
  const prefix = '[IMAP PDF INTAKE] ';
  assert(String(title || '').startsWith(prefix), `Issue title must start with ${prefix}`);
  const titleId = String(title).slice(prefix.length).trim();
  assert(/^[a-z0-9][a-z0-9-]{2,79}$/i.test(titleId), 'Issue title contains an invalid intake ID.');

  const text = String(body || '');
  const start = text.indexOf(CONFIG_START);
  const end = text.indexOf(CONFIG_END);
  assert(start >= 0 && end > start, 'Issue body must contain one locked intake config block.');
  const raw = text.slice(start + CONFIG_START.length, end).trim();
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
  assert(String(config.expectedSubject || '').trim(), 'expectedSubject is required.');
  assert(String(config.expectedSender || '').toLowerCase() === EXPECTED_SENDER, `expectedSender must be ${EXPECTED_SENDER}.`);
  assert(/^.{1,180}\.pdf$/i.test(String(config.expectedFilename || '')), 'expectedFilename must be a PDF filename under 185 characters.');
  assert(/^[a-f0-9]{64}$/.test(String(config.expectedSha256 || '').toLowerCase()), 'expectedSha256 must be a SHA-256 digest.');

  const expectedBytes = Number(config.expectedBytes);
  const expectedPages = Number(config.expectedPages);
  assert(Number.isSafeInteger(expectedBytes) && expectedBytes >= 1 && expectedBytes <= 100000000, 'expectedBytes must be 1-100000000.');
  assert(Number.isSafeInteger(expectedPages) && expectedPages >= 1 && expectedPages <= 300, 'expectedPages must be 1-300.');

  const manifest = config.manifest;
  assert(manifest && typeof manifest === 'object' && !Array.isArray(manifest), 'manifest object is required.');
  assert(Number(manifest.schemaVersion || 1) === 1, 'manifest.schemaVersion must be 1.');
  assert(String(manifest.id || '') === id, 'manifest.id must match config.id.');
  assert(Number.isSafeInteger(Number(manifest.revision || 1)) && Number(manifest.revision || 1) >= 1, 'manifest.revision must be a positive integer.');
  assert(String(manifest.title || '').trim(), 'manifest.title is required.');
  assert(String(manifest.documentTitle || '').trim(), 'manifest.documentTitle is required.');
  assert(String(manifest.copy?.default || '').trim(), 'manifest.copy.default is required.');
  assert(!String(manifest.copy.default).includes('\u2014'), 'manifest.copy.default must not contain em dashes.');
  assert(Array.isArray(manifest.targets) && manifest.targets.length >= 1, 'manifest.targets is required.');
  assert(manifest.targets.every((target) => ALLOWED_TARGETS.has(target)), 'manifest.targets contains an unsupported target.');
  assert((manifest.mode || 'draft') === 'schedule', 'Reusable IMAP intake currently requires mode=schedule.');
  assert(String(manifest.expectedSha256 || '').toLowerCase() === String(config.expectedSha256).toLowerCase(), 'manifest.expectedSha256 must match expectedSha256.');
  assert(!manifest.downloadUrl, 'IMAP intake must not provide manifest.downloadUrl.');
  assert(!manifest.chunks, 'Issue config must not provide manifest.chunks; the verified attachment creates them.');

  assert(manifest.scheduledAt && typeof manifest.scheduledAt === 'object', 'manifest.scheduledAt is required.');
  for (const target of manifest.targets) {
    const scheduled = String(manifest.scheduledAt[target] || '');
    const timestamp = Date.parse(scheduled);
    assert(Number.isFinite(timestamp), `manifest.scheduledAt.${target} must be a valid ISO date/time.`);
    assert(timestamp > nowMs + 10 * 60 * 1000, `manifest.scheduledAt.${target} must be more than 10 minutes in the future.`);
  }

  const sourceUrl = String(manifest.sourceUrl || '');
  assert(/^https:\/\/(?:www\.)?(?:notion\.so|app\.notion\.com)\//i.test(sourceUrl), 'manifest.sourceUrl must be a Notion page URL for live quality gating.');

  return {
    id,
    expectedSubject: String(config.expectedSubject),
    expectedSender: EXPECTED_SENDER,
    expectedFilename: String(config.expectedFilename),
    expectedSha256: String(config.expectedSha256).toLowerCase(),
    expectedBytes,
    expectedPages,
    revision: Number(manifest.revision || 1),
    manifest: { ...manifest, schemaVersion: 1, id, expectedSha256: String(config.expectedSha256).toLowerCase() },
  };
}

module.exports = { CONFIG_START, CONFIG_END, EXPECTED_SENDER, parseIntakeIssue };
