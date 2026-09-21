'use strict';

const REQUIRED_DECISION = 'Keep';
const REQUIRED_APPROVAL = 'Approved';
const REQUIRED_AUTOMATION = new Set(['Ready to Sync', 'Synced', 'Manual']);
const ALLOWED_BUFFER = new Set(['Ready for Buffer', 'Queued in Buffer']);
const BLOCKED_BUFFER = new Set(['Manual Only']);

function extractNotionPageId(sourceUrl = '') {
  const raw = String(sourceUrl || '').trim();
  const match = raw.match(/([0-9a-f]{32})(?:\?|$|\/)/i) || raw.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (!match) throw new Error('Queue item has no usable Notion source page ID.');
  return match[1].replace(/-/g, '').toLowerCase();
}

function normaliseNotionPageId(value = '') { return String(value || '').replace(/-/g, '').toLowerCase(); }
function readSelect(page, name) { return page?.properties?.[name]?.select?.name || null; }
function readCheckbox(page, name) { return page?.properties?.[name]?.checkbox === true; }
function richTextPlainText(items = []) { return (items || []).map((item) => item?.plain_text ?? item?.text?.content ?? '').join(''); }
function readText(page, name) {
  const property = page?.properties?.[name];
  if (!property) return null;
  if (Array.isArray(property.rich_text)) return richTextPlainText(property.rich_text);
  if (Array.isArray(property.title)) return richTextPlainText(property.title);
  if (typeof property.url === 'string') return property.url;
  return null;
}
function readNumber(page, name) {
  const property = page?.properties?.[name];
  if (Number.isFinite(property?.number)) return property.number;
  if (Number.isFinite(property?.unique_id?.number)) return property.unique_id.number;
  return null;
}
function readDateStart(page, name) { return page?.properties?.[name]?.date?.start || null; }
function normaliseText(value) { return String(value ?? '').replace(/\r\n/g, '\n').trim(); }
function sameInstant(a, b) {
  const aa = Date.parse(String(a || ''));
  const bb = Date.parse(String(b || ''));
  return Number.isFinite(aa) && Number.isFinite(bb) && aa === bb;
}
function parseRevision(version) {
  const match = String(version || '').trim().match(/(?:^|\s)(\d+)$/);
  const value = match ? Number(match[1]) : NaN;
  return Number.isInteger(value) && value > 0 ? value : null;
}
function notionTarget(page) {
  const platform = readSelect(page, 'Platform');
  const identity = String(readText(page, 'Posting Identity') || '').trim();
  if (platform === 'LinkedIn Personal' && /^Chelston personal \(personal\)$/i.test(identity)) return 'personal';
  if (platform === 'LinkedIn Company' && /^(?:Triple Two Emails \(222Emails\)|222Emails).*\(main\)$/i.test(identity)) return 'main';
  if (platform === 'LinkedIn Company' && /^222Emails \| Retention School \(secondary\)$/i.test(identity)) return 'secondary';
  return null;
}

function evaluateNotionQualityGate(page, expectedPageId = null, queuePost = null) {
  if (!page || page.object !== 'page') throw new Error('Notion quality lookup did not return a page.');
  if (expectedPageId && normaliseNotionPageId(page.id) !== normaliseNotionPageId(expectedPageId)) {
    throw new Error('Notion quality lookup returned the wrong source page.');
  }

  const decision = readSelect(page, 'Content Decision');
  const approval = readSelect(page, 'Approval');
  const antiDnaPass = readCheckbox(page, 'Anti-DNA | Pass');
  const publicTrustBoundaryPass = readCheckbox(page, 'Public Trust Boundary Pass');
  const storyGate = readSelect(page, 'Story Gate');
  const automationStatus = readSelect(page, 'Automation Status');
  const bufferStatus = readSelect(page, 'Buffer Status');
  const assetReady = readCheckbox(page, 'Asset Ready');
  const automationReady = readCheckbox(page, 'Automation Ready');
  const finalCopy = readText(page, 'Final Copy');
  const publishPayload = readText(page, 'Publish Payload');
  const notionScheduledAt = readDateStart(page, 'Scheduled At');

  const reasons = [];
  if (page.archived === true) reasons.push('Notion source page is archived');
  if (page.in_trash === true) reasons.push('Notion source page is in trash');
  if (decision !== REQUIRED_DECISION) reasons.push(`Content Decision is ${decision || 'unset'}, not ${REQUIRED_DECISION}`);
  if (approval !== REQUIRED_APPROVAL) reasons.push(`Approval is ${approval || 'unset'}, not ${REQUIRED_APPROVAL}`);
  if (!antiDnaPass) reasons.push('Anti-DNA | Pass is not checked');
  if (!publicTrustBoundaryPass) reasons.push('Public Trust Boundary Pass is not checked');
  if (!new Set(['Pass', 'Not Applicable']).has(storyGate)) reasons.push(`Story Gate is ${storyGate || 'unset'}, not Pass or Not Applicable`);
  if (!REQUIRED_AUTOMATION.has(automationStatus)) reasons.push(`Automation Status is ${automationStatus || 'unset'}`);
  if (BLOCKED_BUFFER.has(bufferStatus)) reasons.push(`Buffer Status is ${bufferStatus}`);
  if (!ALLOWED_BUFFER.has(bufferStatus)) reasons.push(`Buffer Status is ${bufferStatus || 'unset'}, not Ready for Buffer or Queued in Buffer`);

  const exactLockedSource = queuePost?.sourceType === 'chatgpt_pdf_intake' || queuePost?.sourceType === 'notion_reserve';
  if (exactLockedSource) {
    if (automationStatus === 'Manual' && queuePost?.sourceType === 'chatgpt_pdf_intake') reasons.push('Automation Status is Manual for governed PDF release');
    if (automationStatus === 'Manual' && queuePost?.sourceType === 'notion_reserve') reasons.push('Automation Status is Manual for governed Notion reserve release');
    if (!assetReady) reasons.push('Asset Ready is not checked');
    if (!automationReady) reasons.push('Automation Ready is not checked');

    const lockedCopy = normaliseText(queuePost.copy?.default);
    if (!lockedCopy) reasons.push('Locked queue copy.default is empty');
    if (normaliseText(finalCopy) !== lockedCopy) reasons.push('Final Copy does not exactly match the locked queue caption');
    if (normaliseText(publishPayload) !== lockedCopy) reasons.push('Publish Payload does not exactly match the locked queue caption');

    const targets = Array.isArray(queuePost.targets) ? queuePost.targets : [];
    if (targets.length !== 1) reasons.push('Governed release must contain exactly one target');
    const targetSchedules = targets.map((target) => queuePost.scheduledAt?.[target]).filter(Boolean);
    if (targetSchedules.length !== 1) reasons.push('Governed release must contain exactly one locked target schedule');
    else if (!notionScheduledAt) reasons.push('Scheduled At is unset in Notion');
    else if (!sameInstant(notionScheduledAt, targetSchedules[0])) reasons.push('Scheduled At does not match the locked queue schedule');
  }

  if (queuePost?.sourceType === 'notion_reserve') {
    if (!readCheckbox(page, 'Reserve Enabled')) reasons.push('Reserve Enabled is not checked');
    if (readSelect(page, 'Publication State') !== 'Approved for Publish') reasons.push('Publication State is not Approved for Publish');
    if (readSelect(page, 'Publication Route') !== 'Buffer') reasons.push('Publication Route is not Buffer');
    if (readCheckbox(page, 'Manual Review Required')) reasons.push('Manual Review Required is checked');
    if (readCheckbox(page, 'Source Needed')) reasons.push('Source Needed is checked');
    if (normaliseText(readText(page, 'Sync Error'))) reasons.push('Sync Error is not empty');
    if (normaliseText(readText(page, 'External Post ID'))) reasons.push('External Post ID is already set before dispatch');
    if (normaliseText(readText(page, 'Post URL'))) reasons.push('Post URL is already set before dispatch');

    const target = notionTarget(page);
    if (!target) reasons.push('Posting identity does not resolve to a supported LinkedIn target');
    else if (queuePost.targets?.[0] !== target) reasons.push('Posting identity target does not match the locked queue target');

    const versionRevision = parseRevision(readText(page, 'Version'));
    if (!versionRevision) reasons.push('Version does not end in a positive integer revision');
    else if (Number(queuePost.revision) !== versionRevision) reasons.push('Version revision does not match the locked queue revision');

    if (normaliseText(readText(page, 'Media URL')) !== normaliseText(queuePost.mediaUrl)) reasons.push('Media URL does not match the locked queue media');
    if (normaliseText(readText(page, 'Media SHA256')).toLowerCase() !== String(queuePost.mediaSha256 || '').toLowerCase()) reasons.push('Media SHA256 does not match the locked queue media');
    if (Number(readNumber(page, 'Media Bytes')) !== Number(queuePost.mediaBytes)) reasons.push('Media Bytes does not match the locked queue media');
    if (normaliseText(readText(page, 'Alt Text')) !== normaliseText(queuePost.mediaAlt)) reasons.push('Alt Text does not match the locked queue media');
    if (normaliseText(readText(page, 'Bridge Fingerprint')) !== normaliseText(queuePost.bridgeFingerprint)) reasons.push('Bridge Fingerprint does not match the locked queue revision');
    const bridgeStatus = readSelect(page, 'Bridge Status');
    if (!new Set(['Staged', 'Waiting Owner Approval', 'Accepted by Buffer']).has(bridgeStatus)) reasons.push(`Bridge Status is ${bridgeStatus || 'unset'}`);
  }

  return {
    pass: reasons.length === 0,
    reasons,
    snapshot: {
      decision,
      approval,
      antiDnaPass,
      publicTrustBoundaryPass,
      storyGate,
      automationStatus,
      bufferStatus,
      assetReady,
      automationReady,
      archived: page.archived === true,
      inTrash: page.in_trash === true,
      scheduledAt: notionScheduledAt,
      exactLockedSource,
      finalCopyMatches: exactLockedSource ? normaliseText(finalCopy) === normaliseText(queuePost?.copy?.default) : null,
      publishPayloadMatches: exactLockedSource ? normaliseText(publishPayload) === normaliseText(queuePost?.copy?.default) : null,
      bridgeFingerprintMatches: queuePost?.sourceType === 'notion_reserve' ? normaliseText(readText(page, 'Bridge Fingerprint')) === normaliseText(queuePost.bridgeFingerprint) : null,
    },
  };
}

async function fetchNotionPage(pageId, token, fetchImpl = fetch) {
  if (!token) throw new Error('Missing NOTION_API_KEY repository secret.');
  const response = await fetchImpl(`https://api.notion.com/v1/pages/${normaliseNotionPageId(pageId)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', Accept: 'application/json' },
  });
  let payload;
  try { payload = await response.json(); } catch { payload = {}; }
  if (!response.ok) throw new Error(`Notion quality lookup failed (${response.status}): ${payload.message || 'unknown error'}`);
  return payload;
}

async function assertLiveNotionQualityGate(queuePost, token, fetchImpl = fetch) {
  if (!queuePost) throw new Error('Queue post was not found for live quality validation.');
  const pageId = extractNotionPageId(queuePost.sourceUrl);
  const page = await fetchNotionPage(pageId, token, fetchImpl);
  const result = evaluateNotionQualityGate(page, pageId, queuePost);
  if (!result.pass) {
    const error = new Error(`${queuePost.id || 'queue item'} failed live Notion quality gate: ${result.reasons.join('; ')}`);
    error.qualityGate = result;
    throw error;
  }
  return result;
}

module.exports = {
  ALLOWED_BUFFER, BLOCKED_BUFFER, REQUIRED_APPROVAL, REQUIRED_DECISION,
  assertLiveNotionQualityGate, evaluateNotionQualityGate, extractNotionPageId,
  fetchNotionPage, normaliseNotionPageId, normaliseText, notionTarget,
  parseRevision, readDateStart, readNumber, readText, sameInstant,
};