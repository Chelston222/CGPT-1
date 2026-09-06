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

function normaliseNotionPageId(value = '') {
  return String(value || '').replace(/-/g, '').toLowerCase();
}

function readSelect(page, name) {
  return page?.properties?.[name]?.select?.name || null;
}

function readCheckbox(page, name) {
  return page?.properties?.[name]?.checkbox === true;
}

function richTextPlainText(items = []) {
  return (items || []).map((item) => item?.plain_text ?? item?.text?.content ?? '').join('');
}

function readText(page, name) {
  const property = page?.properties?.[name];
  if (!property) return null;
  if (Array.isArray(property.rich_text)) return richTextPlainText(property.rich_text);
  if (Array.isArray(property.title)) return richTextPlainText(property.title);
  if (typeof property.url === 'string') return property.url;
  return null;
}

function readDateStart(page, name) {
  return page?.properties?.[name]?.date?.start || null;
}

function normaliseText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

function sameInstant(a, b) {
  const aa = Date.parse(String(a || ''));
  const bb = Date.parse(String(b || ''));
  return Number.isFinite(aa) && Number.isFinite(bb) && aa === bb;
}

function evaluateNotionQualityGate(page, expectedPageId = null, queuePost = null) {
  if (!page || page.object !== 'page') throw new Error('Notion quality lookup did not return a page.');
  if (expectedPageId && normaliseNotionPageId(page.id) !== normaliseNotionPageId(expectedPageId)) {
    throw new Error('Notion quality lookup returned the wrong source page.');
  }

  const decision = readSelect(page, 'Content Decision');
  const approval = readSelect(page, 'Approval');
  const antiDnaPass = readCheckbox(page, 'Anti-DNA | Pass');
  const automationStatus = readSelect(page, 'Automation Status');
  const bufferStatus = readSelect(page, 'Buffer Status');
  const assetReady = readCheckbox(page, 'Asset Ready');
  const automationReady = readCheckbox(page, 'Automation Ready');
  const finalCopy = readText(page, 'Final Copy');
  const publishPayload = readText(page, 'Publish Payload');
  const notionScheduledAt = readDateStart(page, 'Scheduled At');

  const reasons = [];
  if (decision !== REQUIRED_DECISION) reasons.push(`Content Decision is ${decision || 'unset'}, not ${REQUIRED_DECISION}`);
  if (approval !== REQUIRED_APPROVAL) reasons.push(`Approval is ${approval || 'unset'}, not ${REQUIRED_APPROVAL}`);
  if (!antiDnaPass) reasons.push('Anti-DNA | Pass is not checked');
  if (!REQUIRED_AUTOMATION.has(automationStatus)) reasons.push(`Automation Status is ${automationStatus || 'unset'}`);
  if (BLOCKED_BUFFER.has(bufferStatus)) reasons.push(`Buffer Status is ${bufferStatus}`);
  if (!ALLOWED_BUFFER.has(bufferStatus)) reasons.push(`Buffer Status is ${bufferStatus || 'unset'}, not Ready for Buffer or Queued in Buffer`);

  if (queuePost?.sourceType === 'chatgpt_pdf_intake') {
    if (!assetReady) reasons.push('Asset Ready is not checked');
    if (!automationReady) reasons.push('Automation Ready is not checked');

    const lockedCopy = normaliseText(queuePost.copy?.default);
    if (!lockedCopy) reasons.push('Locked queue copy.default is empty');
    if (normaliseText(finalCopy) !== lockedCopy) reasons.push('Final Copy does not exactly match the locked queue caption');
    if (normaliseText(publishPayload) !== lockedCopy) reasons.push('Publish Payload does not exactly match the locked queue caption');

    const targetSchedules = (queuePost.targets || []).map((target) => queuePost.scheduledAt?.[target]).filter(Boolean);
    if (targetSchedules.length === 1) {
      if (!notionScheduledAt) reasons.push('Scheduled At is unset in Notion');
      else if (!sameInstant(notionScheduledAt, targetSchedules[0])) reasons.push('Scheduled At does not match the locked queue schedule');
    } else if (targetSchedules.length > 1) {
      const instants = new Set(targetSchedules.map((value) => Date.parse(value)).filter(Number.isFinite));
      if (instants.size === 1) {
        if (!notionScheduledAt || !sameInstant(notionScheduledAt, targetSchedules[0])) reasons.push('Scheduled At does not match the shared locked queue schedule');
      }
    }
  }

  return {
    pass: reasons.length === 0,
    reasons,
    snapshot: {
      decision,
      approval,
      antiDnaPass,
      automationStatus,
      bufferStatus,
      assetReady,
      automationReady,
      scheduledAt: notionScheduledAt,
      finalCopyMatches: queuePost?.sourceType === 'chatgpt_pdf_intake' ? normaliseText(finalCopy) === normaliseText(queuePost.copy?.default) : null,
      publishPayloadMatches: queuePost?.sourceType === 'chatgpt_pdf_intake' ? normaliseText(publishPayload) === normaliseText(queuePost.copy?.default) : null,
    },
  };
}

async function fetchNotionPage(pageId, token, fetchImpl = fetch) {
  if (!token) throw new Error('Missing NOTION_API_KEY repository secret.');
  const response = await fetchImpl(`https://api.notion.com/v1/pages/${normaliseNotionPageId(pageId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      Accept: 'application/json',
    },
  });
  let payload;
  try { payload = await response.json(); } catch { payload = {}; }
  if (!response.ok) {
    throw new Error(`Notion quality lookup failed (${response.status}): ${payload.message || 'unknown error'}`);
  }
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
  ALLOWED_BUFFER,
  BLOCKED_BUFFER,
  REQUIRED_APPROVAL,
  REQUIRED_DECISION,
  assertLiveNotionQualityGate,
  evaluateNotionQualityGate,
  extractNotionPageId,
  fetchNotionPage,
  normaliseNotionPageId,
  normaliseText,
  readDateStart,
  readText,
  sameInstant,
};
