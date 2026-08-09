'use strict';

const REVIEW_SYNC_ENDPOINT = '/api/review-decisions';
const REVIEW_SYNC_KEY_STORAGE = 'content-swiper-review-sync-key-v1';
const REVIEW_SYNC_POLL_MS = 60_000;

const originalSaveDecisions = saveDecisions;
let lastSyncedDecisions = {};
let syncWriteChain = Promise.resolve();
let syncButton = null;
let syncReady = false;

function cloneDecisions(value = state.decisions) {
  return JSON.parse(JSON.stringify(value || {}));
}

function syncKey() {
  return localStorage.getItem(REVIEW_SYNC_KEY_STORAGE) || '';
}

function syncEnabled() {
  return Boolean(syncKey());
}

function ledgerId() {
  return state.queue?.masterLedger?.id || '';
}

function validDecisionForCurrentQueue(postId, decision) {
  const post = state.posts.find((item) => item.id === postId);
  return Boolean(
    post
    && decision
    && ['approve', 'reject'].includes(decision.decision)
    && Number(decision.revision) === Number(post.revision)
    && Number.isFinite(Date.parse(decision.at)),
  );
}

function setSyncButton(status, detail = '') {
  if (!syncButton) return;
  const labels = {
    off: '↔ Sync',
    connecting: '↔ Syncing…',
    on: '↔ Synced',
    error: '↔ Retry sync',
  };
  syncButton.textContent = labels[status] || labels.off;
  syncButton.dataset.syncState = status;
  syncButton.title = detail || (status === 'on'
    ? 'YES/NO review choices are centralised across connected devices. GitHub still controls final publishing approval.'
    : 'Connect this device so YES/NO review choices follow you across devices.');
  syncButton.setAttribute('aria-label', syncButton.title);
}

function installSyncControl() {
  if (syncButton) return;
  const topbar = document.querySelector('.topbar');
  const refresh = document.querySelector('#refresh-button');
  if (!topbar || !refresh) return;

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.alignItems = 'center';
  actions.style.gap = '8px';

  syncButton = document.createElement('button');
  syncButton.type = 'button';
  syncButton.className = 'icon-button';
  syncButton.style.whiteSpace = 'nowrap';
  syncButton.addEventListener('click', connectOrRefreshSync);

  topbar.insertBefore(actions, refresh);
  actions.append(syncButton, refresh);
  setSyncButton(syncEnabled() ? 'connecting' : 'off');
}

async function requestRemote(method, body) {
  const key = syncKey();
  if (!key || !ledgerId()) throw new Error('Device sync is not connected.');
  const response = await fetch(`${REVIEW_SYNC_ENDPOINT}?ledgerId=${encodeURIComponent(ledgerId())}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-review-sync-key': key,
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Decision sync returned HTTP ${response.status}.`);
  }
  if (!response.ok) {
    const error = new Error(payload.error || `Decision sync returned HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function latestDecision(localDecisionValue, remoteDecisionValue) {
  if (!localDecisionValue) return remoteDecisionValue;
  if (!remoteDecisionValue) return localDecisionValue;
  return Date.parse(remoteDecisionValue.at) > Date.parse(localDecisionValue.at)
    ? remoteDecisionValue
    : localDecisionValue;
}

async function pullAndMergeRemote() {
  if (!syncEnabled() || !ledgerId()) return;
  setSyncButton('connecting');
  const payload = await requestRemote('GET');
  const remote = Object.fromEntries(
    Object.entries(payload.decisions || {}).filter(([postId, decision]) => validDecisionForCurrentQueue(postId, decision)),
  );
  const localBefore = cloneDecisions();
  const merged = {};
  const keys = new Set([...Object.keys(localBefore), ...Object.keys(remote)]);

  for (const postId of keys) {
    const localValue = validDecisionForCurrentQueue(postId, localBefore[postId]) ? localBefore[postId] : null;
    const remoteValue = validDecisionForCurrentQueue(postId, remote[postId]) ? remote[postId] : null;
    const winner = latestDecision(localValue, remoteValue);
    if (winner) merged[postId] = winner;
  }

  state.decisions = merged;
  originalSaveDecisions();
  lastSyncedDecisions = cloneDecisions(remote);

  const localWinners = Object.entries(merged)
    .filter(([postId, decision]) => JSON.stringify(decision) !== JSON.stringify(remote[postId]))
    .map(([postId, decision]) => ({ postId, ...decision }));

  if (localWinners.length) {
    await requestRemote('POST', { updates: localWinners, deletes: [] });
  }

  lastSyncedDecisions = cloneDecisions(merged);
  if (typeof applyFilters === 'function') applyFilters();
  setSyncButton('on');
}

function decisionDelta() {
  const current = state.decisions || {};
  const updates = [];
  const deletes = [];
  const keys = new Set([...Object.keys(lastSyncedDecisions), ...Object.keys(current)]);

  for (const postId of keys) {
    const before = lastSyncedDecisions[postId];
    const after = current[postId];
    if (!after && before) {
      deletes.push(postId);
      continue;
    }
    if (after && JSON.stringify(after) !== JSON.stringify(before) && validDecisionForCurrentQueue(postId, after)) {
      updates.push({ postId, ...after });
    }
  }
  return { updates, deletes };
}

async function pushLocalDelta() {
  if (!syncEnabled() || !ledgerId()) return;
  const { updates, deletes } = decisionDelta();
  if (!updates.length && !deletes.length) return;
  setSyncButton('connecting');
  await requestRemote('POST', { updates, deletes });
  lastSyncedDecisions = cloneDecisions();
  setSyncButton('on');
}

saveDecisions = function syncedSaveDecisions() {
  originalSaveDecisions();
  if (!syncEnabled()) return;
  syncWriteChain = syncWriteChain
    .then(pushLocalDelta)
    .catch((error) => {
      if (error.status === 401) localStorage.removeItem(REVIEW_SYNC_KEY_STORAGE);
      setSyncButton('error', `${error.message} Your choice is still safely saved on this device.`);
    });
};

const originalOpenDecision = openDecision;
openDecision = function syncedOpenDecision(decision) {
  originalOpenDecision(decision);
  if (!syncEnabled()) return;
  if (decision === 'approve') {
    elements.safetyNote.textContent = `This YES is saved to your private cross-device review state. It is still not permission to publish. Buffer is contacted only after the final owner-authenticated GitHub approval.${!carouselIsPublishable(state.filtered[state.index]) ? ' This editorial YES cannot send a missing-media carousel.' : ''}`;
  } else {
    elements.safetyNote.textContent = 'NO is saved to your private cross-device review state and never contacts Buffer. The revision note follows the decision across connected devices.';
  }
};

async function connectOrRefreshSync() {
  if (!syncEnabled()) {
    const key = window.prompt('Enter the private Content Swiper sync key for this device. It is stored only in this browser.');
    if (!key) return;
    localStorage.setItem(REVIEW_SYNC_KEY_STORAGE, key.trim());
  }
  try {
    await pullAndMergeRemote();
  } catch (error) {
    if (error.status === 401) {
      localStorage.removeItem(REVIEW_SYNC_KEY_STORAGE);
      setSyncButton('error', 'The sync key was not recognised. Press Sync to try again.');
      return;
    }
    setSyncButton('error', `${error.message} Local review choices remain available.`);
  }
}

async function initialiseDecisionSync() {
  installSyncControl();
  const started = Date.now();
  while (!state.queue && Date.now() - started < 12_000) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!state.queue) {
    setSyncButton('error', 'The review queue did not finish loading.');
    return;
  }
  lastSyncedDecisions = cloneDecisions();
  syncReady = true;
  if (syncEnabled()) await connectOrRefreshSync();
}

window.addEventListener('focus', () => {
  if (syncReady && syncEnabled()) connectOrRefreshSync();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && syncReady && syncEnabled()) connectOrRefreshSync();
});
window.setInterval(() => {
  if (document.visibilityState === 'visible' && syncReady && syncEnabled()) connectOrRefreshSync();
}, REVIEW_SYNC_POLL_MS);

initialiseDecisionSync().catch((error) => setSyncButton('error', error.message));
