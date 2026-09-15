'use strict';

const crypto = require('node:crypto');

const REQUIRED = Object.freeze({
  decision: 'Keep',
  approval: 'Approved',
  publicationState: 'Approved for Publish',
  automationStatus: 'Ready to Sync',
  bufferStatus: 'Ready for Buffer',
  publicationRoute: 'Buffer',
});

const IDENTITY_TARGETS = Object.freeze([
  { platform: 'LinkedIn Personal', pattern: /^Chelston personal \(personal\)$/i, target: 'personal' },
  { platform: 'LinkedIn Company', pattern: /^(?:Triple Two Emails \(222Emails\)|222Emails).*\(main\)$/i, target: 'main' },
  { platform: 'LinkedIn Company', pattern: /^222Emails \| Retention School \(secondary\)$/i, target: 'secondary' },
]);

function plainText(items = []) {
  return (items || []).map((item) => item?.plain_text ?? item?.text?.content ?? '').join('');
}
function prop(page, name) { return page?.properties?.[name] || null; }
function readSelect(page, name) { return prop(page, name)?.select?.name || null; }
function readCheckbox(page, name) { return prop(page, name)?.checkbox === true; }
function readText(page, name) {
  const value = prop(page, name);
  if (!value) return '';
  if (Array.isArray(value.rich_text)) return plainText(value.rich_text);
  if (Array.isArray(value.title)) return plainText(value.title);
  if (typeof value.url === 'string') return value.url;
  return '';
}
function readNumber(page, name) {
  const value = prop(page, name);
  if (!value) return null;
  if (Number.isFinite(value.number)) return value.number;
  if (Number.isFinite(value.unique_id?.number)) return value.unique_id.number;
  return null;
}
function readDate(page, name) { return prop(page, name)?.date?.start || null; }
function normaliseText(value) { return String(value ?? '').replace(/\r\n/g, '\n').trim(); }
function normalisePageId(value = '') { return String(value || '').replace(/-/g, '').toLowerCase(); }

function validateStableMediaUrl(raw) {
  if (!raw) throw new Error('Media URL is missing. Stage the exact approved media first.');
  let url;
  try { url = new URL(raw); } catch { throw new Error('Media URL is invalid.'); }
  if (url.protocol !== 'https:') throw new Error('Media URL must use HTTPS.');
  const host = url.hostname.toLowerCase();
  const blocked = new Set(['drive.google.com', 'docs.google.com', 'www.notion.so', 'notion.so', 'app.notion.com']);
  if (blocked.has(host) || host.endsWith('.notion.site')) throw new Error('Media URL must be a stable direct public file URL, not a Drive or Notion share URL.');
  const keys = [...url.searchParams.keys()].map((x) => x.toLowerCase());
  if (keys.includes('x-amz-signature') || keys.includes('x-goog-signature')) throw new Error('Media URL must not be an expiring signed URL.');
  return url.toString();
}

function parseRevision(version) {
  const match = String(version || '').trim().match(/(?:^|\s)(\d+)$/);
  const value = match ? Number(match[1]) : NaN;
  if (!Number.isInteger(value) || value < 1) throw new Error('Version must end in a positive integer revision.');
  return value;
}

function resolveTarget(platform, identity) {
  const match = IDENTITY_TARGETS.find((entry) => entry.platform === platform && entry.pattern.test(String(identity || '').trim()));
  if (!match) throw new Error(`Unsupported or mismatched posting identity: ${platform || 'unset'} / ${identity || 'unset'}.`);
  return match.target;
}

function categoryFromPillar(pillar = '') {
  const map = {
    'Repeat Bookings': 'repeat_bookings',
    'Quiet Weeks': 'quiet_capacity',
    'Follow-Up Leaks': 'follow_up_leaks',
    'Retention Strategy': 'retention_strategy',
    'AI & Systems': 'automation_quality',
    'Founder Journey': 'founder_operator_pov',
    'Business Lessons': 'business_lesson',
    'Offer': 'offer_conversion',
    'Compliance': 'compliance',
  };
  return map[pillar] || 'client_return_system';
}

function evaluateReserveEligibility(page, now = Date.now()) {
  if (!page || page.object !== 'page') throw new Error('Expected a Notion page payload.');
  const reasons = [];
  const decision = readSelect(page, 'Content Decision');
  const approval = readSelect(page, 'Approval');
  const publicationState = readSelect(page, 'Publication State');
  const automationStatus = readSelect(page, 'Automation Status');
  const bufferStatus = readSelect(page, 'Buffer Status');
  const publicationRoute = readSelect(page, 'Publication Route');
  const platform = readSelect(page, 'Platform');
  const identity = readText(page, 'Posting Identity');
  const finalCopy = normaliseText(readText(page, 'Final Copy'));
  const publishPayload = normaliseText(readText(page, 'Publish Payload'));
  const mediaUrl = readText(page, 'Media URL');
  const altText = normaliseText(readText(page, 'Alt Text'));
  const version = readText(page, 'Version');
  const scheduledAt = readDate(page, 'Scheduled At');
  const reviewDue = readDate(page, 'Visual Review Due');
  const postIdNumber = readNumber(page, 'Post ID');
  let target = null;
  let revision = null;
  let stableMediaUrl = null;

  if (page.archived === true) reasons.push('Notion page is archived');
  if (page.in_trash === true) reasons.push('Notion page is in trash');
  if (decision !== REQUIRED.decision) reasons.push(`Content Decision must be ${REQUIRED.decision}`);
  if (approval !== REQUIRED.approval) reasons.push(`Approval must be ${REQUIRED.approval}`);
  if (publicationState !== REQUIRED.publicationState) reasons.push(`Publication State must be ${REQUIRED.publicationState}`);
  if (!readCheckbox(page, 'Asset Ready')) reasons.push('Asset Ready must be checked');
  if (!readCheckbox(page, 'Automation Ready')) reasons.push('Automation Ready must be checked');
  if (automationStatus !== REQUIRED.automationStatus) reasons.push(`Automation Status must be ${REQUIRED.automationStatus}`);
  if (!readCheckbox(page, 'Anti-DNA | Pass')) reasons.push('Anti-DNA | Pass must be checked');
  if (bufferStatus !== REQUIRED.bufferStatus) reasons.push(`Buffer Status must be ${REQUIRED.bufferStatus}`);
  if (publicationRoute !== REQUIRED.publicationRoute) reasons.push(`Publication Route must be ${REQUIRED.publicationRoute}`);
  if (!readCheckbox(page, 'Reserve Enabled')) reasons.push('Reserve Enabled must be checked');
  if (readCheckbox(page, 'Manual Review Required')) reasons.push('Manual Review Required must be clear');
  if (readCheckbox(page, 'Source Needed')) reasons.push('Source Needed must be clear');
  if (normaliseText(readText(page, 'External Post ID'))) reasons.push('External Post ID must be empty before staging');
  if (normaliseText(readText(page, 'Post URL'))) reasons.push('Post URL must be empty before staging');
  if (normaliseText(readText(page, 'Sync Error'))) reasons.push('Sync Error must be empty before staging');
  if (!finalCopy) reasons.push('Final Copy is empty');
  if (!publishPayload) reasons.push('Publish Payload is empty');
  if (finalCopy && publishPayload && finalCopy !== publishPayload) reasons.push('Publish Payload must exactly match Final Copy');
  if (!altText) reasons.push('Alt Text is empty');
  if (!Number.isInteger(postIdNumber) || postIdNumber < 1) reasons.push('Post ID is missing');

  try { target = resolveTarget(platform, identity); } catch (error) { reasons.push(error.message); }
  try { revision = parseRevision(version); } catch (error) { reasons.push(error.message); }
  try { stableMediaUrl = validateStableMediaUrl(mediaUrl); } catch (error) { reasons.push(error.message); }

  const scheduledMs = Date.parse(String(scheduledAt || ''));
  if (!Number.isFinite(scheduledMs)) reasons.push('Scheduled At must be set to a valid date-time');
  else if (scheduledMs <= now + 5 * 60_000) reasons.push('Scheduled At must be more than five minutes in the future');

  const reviewMs = Date.parse(String(reviewDue || ''));
  if (!Number.isFinite(reviewMs)) reasons.push('Visual Review Due must be set');
  else if (reviewMs < now) reasons.push('Visual Review Due has expired');
  else if (Number.isFinite(scheduledMs) && reviewMs < scheduledMs) reasons.push('Visual Review Due must not expire before the scheduled post');

  return {
    pass: reasons.length === 0,
    reasons,
    snapshot: {
      pageId: normalisePageId(page.id),
      postIdNumber,
      title: normaliseText(readText(page, 'Post')),
      pillar: readSelect(page, 'Pillar') || '',
      funnel: readSelect(page, 'Funnel') || '',
      platform,
      identity,
      target,
      revision,
      version: normaliseText(version),
      finalCopy,
      publishPayload,
      mediaUrl: stableMediaUrl,
      altText,
      scheduledAt,
      reviewDue,
      reserveOrder: readNumber(page, 'Reserve Order'),
    },
  };
}

function canonicalFingerprintInput(snapshot, media) {
  return {
    pageId: snapshot.pageId,
    postIdNumber: snapshot.postIdNumber,
    revision: snapshot.revision,
    title: snapshot.title,
    category: categoryFromPillar(snapshot.pillar),
    funnel: String(snapshot.funnel || '').toLowerCase(),
    target: snapshot.target,
    scheduledAt: snapshot.scheduledAt,
    copy: snapshot.finalCopy,
    mediaUrl: snapshot.mediaUrl,
    mediaBytes: media.bytes,
    mediaSha256: String(media.sha256 || '').toLowerCase(),
    altText: snapshot.altText,
  };
}

function fingerprint(snapshot, media) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalFingerprintInput(snapshot, media))).digest('hex');
}

function buildCandidate(page, media, now = Date.now()) {
  const eligibility = evaluateReserveEligibility(page, now);
  if (!eligibility.pass) throw new Error(`Notion reserve row is not stage-eligible: ${eligibility.reasons.join('; ')}`);
  if (!Number.isInteger(media?.bytes) || media.bytes < 1) throw new Error('Media byte count is invalid.');
  if (!/^[a-f0-9]{64}$/i.test(String(media?.sha256 || ''))) throw new Error('Media SHA-256 is invalid.');
  const s = eligibility.snapshot;
  const bridgeFingerprint = fingerprint(s, media);
  const id = `tte-reserve-${s.postIdNumber}`;
  return {
    id,
    revision: s.revision,
    title: s.title || id,
    category: categoryFromPillar(s.pillar),
    funnelStage: String(s.funnel || '').toLowerCase() || 'mof',
    format: 'poster',
    targets: [s.target],
    mode: 'schedule',
    scheduledAt: { [s.target]: s.scheduledAt },
    copy: { default: s.finalCopy },
    mediaUrl: s.mediaUrl,
    mediaPreviewUrl: s.mediaUrl,
    mediaAlt: s.altText,
    mediaBytes: media.bytes,
    mediaSha256: String(media.sha256).toLowerCase(),
    safeZoneQa: 'pass',
    sourceUrl: `https://app.notion.com/${s.pageId}`,
    sourceType: 'notion_reserve',
    status: 'review',
    reserveOrder: s.reserveOrder,
    bridgeFingerprint,
    qa: {
      status: 'ready_for_human_review',
      approvalEligible: true,
      publishPermission: false,
      contentQa: 'pass',
      safeZoneQa: 'pass',
      bridgeFingerprint,
    },
    history: [{
      state: 'notion_reserve_staged',
      at: new Date(now).toISOString(),
      actor: 'github-actions[bot]',
      note: 'Staged from an explicitly eligible Notion reserve row. Publication still requires repository-owner GitHub approval.',
    }],
  };
}

function stableCandidateFingerprint(candidate) {
  return JSON.stringify({
    id: candidate.id,
    revision: Number(candidate.revision),
    title: candidate.title,
    category: candidate.category,
    funnelStage: candidate.funnelStage,
    format: candidate.format,
    targets: candidate.targets,
    mode: candidate.mode,
    scheduledAt: candidate.scheduledAt,
    copy: candidate.copy,
    mediaUrl: candidate.mediaUrl,
    mediaAlt: candidate.mediaAlt,
    mediaBytes: candidate.mediaBytes,
    mediaSha256: candidate.mediaSha256,
    safeZoneQa: candidate.safeZoneQa,
    sourceUrl: candidate.sourceUrl,
    sourceType: candidate.sourceType,
    status: candidate.status,
    reserveOrder: candidate.reserveOrder,
    bridgeFingerprint: candidate.bridgeFingerprint,
    qa: candidate.qa,
  });
}

function mergeCandidate(payload = { schemaVersion: 1, posts: [] }, candidate) {
  const posts = Array.isArray(payload.posts) ? [...payload.posts] : [];
  const index = posts.findIndex((post) => post.id === candidate.id);
  if (index < 0) return { changed: true, reason: 'created', payload: { ...payload, schemaVersion: payload.schemaVersion || 1, posts: [...posts, candidate] } };
  const existing = posts[index];
  const existingRevision = Number(existing.revision || 0);
  const incomingRevision = Number(candidate.revision || 0);
  if (incomingRevision < existingRevision) throw new Error(`${candidate.id} revision ${incomingRevision} is older than staged revision ${existingRevision}.`);
  if (incomingRevision === existingRevision) {
    if (stableCandidateFingerprint(existing) !== stableCandidateFingerprint(candidate)) {
      throw new Error(`${candidate.id}@${incomingRevision} drifted after staging. Increment Version before restaging.`);
    }
    return { changed: false, reason: 'idempotent_replay', payload: { ...payload, posts } };
  }
  posts[index] = candidate;
  return { changed: true, reason: 'revision_advanced', payload: { ...payload, posts } };
}

module.exports = {
  IDENTITY_TARGETS,
  REQUIRED,
  buildCandidate,
  categoryFromPillar,
  evaluateReserveEligibility,
  fingerprint,
  mergeCandidate,
  normalisePageId,
  normaliseText,
  parseRevision,
  resolveTarget,
  stableCandidateFingerprint,
  validateStableMediaUrl,
};