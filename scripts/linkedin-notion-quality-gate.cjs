'use strict';

const REQUIRED_DECISION = 'Keep';
const REQUIRED_APPROVAL = 'Approved';
const REQUIRED_AUTOMATION = new Set(['Ready to Sync', 'Synced', 'Manual']);
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

function evaluateNotionQualityGate(page, expectedPageId = null) {
  if (!page || page.object !== 'page') throw new Error('Notion quality lookup did not return a page.');
  if (expectedPageId && normaliseNotionPageId(page.id) !== normaliseNotionPageId(expectedPageId)) {
    throw new Error('Notion quality lookup returned the wrong source page.');
  }

  const decision = readSelect(page, 'Content Decision');
  const approval = readSelect(page, 'Approval');
  const antiDnaPass = readCheckbox(page, 'Anti-DNA | Pass');
  const automationStatus = readSelect(page, 'Automation Status');
  const bufferStatus = readSelect(page, 'Buffer Status');

  const reasons = [];
  if (decision !== REQUIRED_DECISION) reasons.push(`Content Decision is ${decision || 'unset'}, not ${REQUIRED_DECISION}`);
  if (approval !== REQUIRED_APPROVAL) reasons.push(`Approval is ${approval || 'unset'}, not ${REQUIRED_APPROVAL}`);
  if (!antiDnaPass) reasons.push('Anti-DNA | Pass is not checked');
  if (!REQUIRED_AUTOMATION.has(automationStatus)) reasons.push(`Automation Status is ${automationStatus || 'unset'}`);
  if (BLOCKED_BUFFER.has(bufferStatus)) reasons.push(`Buffer Status is ${bufferStatus}`);

  return {
    pass: reasons.length === 0,
    reasons,
    snapshot: { decision, approval, antiDnaPass, automationStatus, bufferStatus },
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
  const result = evaluateNotionQualityGate(page, pageId);
  if (!result.pass) {
    const error = new Error(`${queuePost.id || 'queue item'} failed live Notion quality gate: ${result.reasons.join('; ')}`);
    error.qualityGate = result;
    throw error;
  }
  return result;
}

module.exports = {
  REQUIRED_APPROVAL,
  REQUIRED_DECISION,
  assertLiveNotionQualityGate,
  evaluateNotionQualityGate,
  extractNotionPageId,
  fetchNotionPage,
  normaliseNotionPageId,
};
