'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MANIFEST_PATH = 'apps/linkedin-review/buffer-migration-2026-08-23.json';
const EXPECTED_MANIFEST_BLOB_SHA = '9bb89ddf0d8a392f03a4f8c97c5cead8d8faeb1c';
const MIGRATION_ID = 'buffer-migration-2026-08-23';

function parseHeaders(body = '') {
  const out = {};
  for (const line of String(body).split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]+):\s*(.*)$/);
    if (match) out[match[1]] = match[2].trim();
  }
  return out;
}

function normalizeIso(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid ISO timestamp ${value}`);
  return date.toISOString();
}

function localDate(value, timeZone = 'Europe/London') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date ${value}`);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function weekKey(local) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(local || '');
  if (!match) throw new Error(`Invalid local date ${local}`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function cadenceFailures(rows, targetByChannel, policy, timeZone = 'Europe/London') {
  const daily = new Map();
  const weekly = new Map();
  for (const row of rows) {
    const target = targetByChannel[row.channelId];
    if (!target) continue;
    const date = localDate(row.dueAt, timeZone);
    const week = weekKey(date);
    daily.set(`${date}:${target}`, (daily.get(`${date}:${target}`) || 0) + 1);
    weekly.set(`${week}:${target}`, (weekly.get(`${week}:${target}`) || 0) + 1);
  }
  const failures = [];
  for (const [key, count] of daily) {
    const target = key.split(':').at(-1);
    const max = Number(policy.accounts?.[target]?.maximumPerDay);
    if (Number.isFinite(max) && count > max) failures.push(`${key} ${count}>${max}/day`);
  }
  for (const [key, count] of weekly) {
    const target = key.split(':').at(-1);
    const max = Number(policy.accounts?.[target]?.maximumPerWeek);
    if (Number.isFinite(max) && count > max) failures.push(`${key} ${count}>${max}/week`);
  }
  return failures;
}

function parseBufferIdFromComments(comments, row) {
  const prefix = `- ${row.id}@${row.revision} · `;
  for (const comment of comments || []) {
    for (const line of String(comment.body || '').split(/\r?\n/)) {
      if (!line.startsWith(prefix)) continue;
      const match = line.match(/Buffer post ID\s+`([^`]+)`/);
      if (match) return match[1];
    }
  }
  return null;
}

function parseMigrationMarkers(comments = []) {
  const intents = new Set();
  const applied = new Set();
  for (const comment of comments) {
    const body = String(comment.body || '');
    const intentRegex = /<!-- BUFFER_MIGRATION_INTENT key=([^\s>]+)/g;
    const appliedRegex = /<!-- BUFFER_MIGRATION_APPLIED key=([^\s>]+)/g;
    let match;
    while ((match = intentRegex.exec(body))) intents.add(match[1]);
    while ((match = appliedRegex.exec(body))) applied.add(match[1]);
  }
  return { intents, applied };
}

function validateManifest(manifest) {
  if (manifest.status !== 'classified_not_applied') throw new Error('Manifest must remain classified_not_applied until external writeback is independently verified.');
  if (manifest.sourceSnapshotIssue !== 381 || manifest.governingIssue !== 331) throw new Error('Manifest source/governance issue IDs are not locked.');
  if (!Array.isArray(manifest.placements) || manifest.placements.length !== 26) throw new Error('Manifest must contain the 26 source-snapshot placements.');
  const nonKeep = manifest.placements.filter((row) => row.decision !== 'KEEP');
  if (nonKeep.length !== 4) throw new Error(`Expected exactly 4 non-KEEP decisions; found ${nonKeep.length}.`);
  if (nonKeep.filter((row) => row.decision === 'MOVE').length !== 2) throw new Error('Expected exactly two MOVE decisions.');
  if (nonKeep.filter((row) => row.decision === 'REPURPOSE').length !== 2) throw new Error('Expected exactly two REPURPOSE decisions.');
  if (manifest.placements.some((row) => row.decision === 'RETIRE')) throw new Error('This migration must not retire source inventory.');
  return nonKeep;
}

async function run({ github, context, core, env = process.env, workspace = process.env.GITHUB_WORKSPACE, now = Date.now() }) {
  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const issueNumber = context.issue.number;
  const manifest = JSON.parse(fs.readFileSync(path.join(workspace, MANIFEST_PATH), 'utf8'));
  const policy = JSON.parse(fs.readFileSync(path.join(workspace, 'apps/linkedin-review/distribution-policy.json'), 'utf8'));
  const nonKeep = validateManifest(manifest);

  const approval = parseHeaders(context.payload.issue.body || '');
  if (approval.MIGRATION_ID !== MIGRATION_ID) throw new Error('MIGRATION_ID does not match the locked migration.');
  if (approval.MANIFEST_BLOB_SHA !== EXPECTED_MANIFEST_BLOB_SHA) throw new Error('MANIFEST_BLOB_SHA does not match the locked manifest revision.');
  if (approval.SOURCE_SNAPSHOT_ISSUE !== '381') throw new Error('SOURCE_SNAPSHOT_ISSUE must be 381.');
  if (approval.PLAN_SELFTEST_ISSUE !== '382') throw new Error('PLAN_SELFTEST_ISSUE must be 382.');
  if (approval.APPLY !== 'YES') throw new Error('APPLY: YES is required.');

  const manifestMeta = await github.rest.repos.getContent({ owner, repo, path: MANIFEST_PATH, ref: context.sha });
  if (Array.isArray(manifestMeta.data) || manifestMeta.data.sha !== EXPECTED_MANIFEST_BLOB_SHA) {
    throw new Error('Checked-out migration manifest differs from the owner-approved blob.');
  }

  if (!env.BUFFER_API_KEY) throw new Error('BUFFER_API_KEY is not configured.');
  const channelIds = {
    personal: env.BUFFER_LINKEDIN_PERSONAL_CHANNEL_ID,
    main: env.BUFFER_LINKEDIN_BUSINESS_CHANNEL_ID,
    secondary: env.BUFFER_LINKEDIN_SECONDARY_CHANNEL_ID,
  };
  if (Object.values(channelIds).some((id) => !id)) throw new Error('One or more LinkedIn Buffer channel IDs are missing.');
  const targetByChannel = Object.fromEntries(Object.entries(channelIds).map(([target, id]) => [id, target]));

  async function buffer(query, variables = {}) {
    const response = await fetch('https://api.buffer.com', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.BUFFER_API_KEY}` },
      body: JSON.stringify({ query, variables }),
    });
    const payload = await response.json().catch(() => ({}));
    const fatal = (payload.errors || []).map((error) => error.message).filter(Boolean);
    if (!response.ok || fatal.length) throw new Error(fatal.join('; ') || `Buffer HTTP ${response.status}`);
    return payload.data;
  }

  async function scheduledPosts() {
    const account = await buffer('query MigrationAccount { account { organizations { id } } }');
    const organizationId = account.account?.organizations?.[0]?.id;
    if (!organizationId) throw new Error('Buffer returned no organisation ID.');
    const data = await buffer(`query MigrationScheduled { posts(first: 100, input: { organizationId: ${JSON.stringify(organizationId)}, filter: { status: [scheduled], channelIds: ${JSON.stringify(Object.values(channelIds))} } }) { edges { node { id channelId dueAt status } } pageInfo { hasNextPage } } }`);
    if (data.posts?.pageInfo?.hasNextPage) throw new Error('Buffer scheduled-post query exceeds 100 rows; refusing incomplete migration evidence.');
    return (data.posts?.edges || []).map((edge) => edge.node);
  }

  for (const row of nonKeep) {
    if (Date.parse(row.bufferDueAt) <= now + 60 * 60 * 1000) throw new Error(`${row.id} original due time is too close or passed; re-snapshot and re-approve.`);
    if (row.decision === 'MOVE' && Date.parse(row.proposedDueAt) <= now + 60 * 60 * 1000) throw new Error(`${row.id} proposed due time is too close or passed; re-plan.`);
  }

  const bufferIdByQueueKey = new Map();
  for (const row of manifest.placements) {
    const comments = await github.paginate(github.rest.issues.listComments, { owner, repo, issue_number: row.approvalIssue, per_page: 100 });
    const bufferId = parseBufferIdFromComments(comments, row);
    if (!bufferId) throw new Error(`Could not recover Buffer ID for ${row.id}@${row.revision} from approval issue #${row.approvalIssue}.`);
    bufferIdByQueueKey.set(`${row.id}@${row.revision}`, bufferId);
  }

  let runComments = await github.paginate(github.rest.issues.listComments, { owner, repo, issue_number: issueNumber, per_page: 100 });
  let markers = parseMigrationMarkers(runComments);
  let before = await scheduledPosts();
  let beforeById = new Map(before.map((post) => [post.id, post]));

  const appliedRepurposeCount = nonKeep.filter((row) => row.decision === 'REPURPOSE' && markers.applied.has(`${row.id}@${row.revision}:${row.target}`)).length;
  const expectedCurrentCount = manifest.summary.livePlacements - appliedRepurposeCount;
  if (before.length !== expectedCurrentCount) throw new Error(`Live queue drift: expected ${expectedCurrentCount} scheduled placements at this migration checkpoint; found ${before.length}.`);

  for (const row of manifest.placements) {
    const queueKey = `${row.id}@${row.revision}`;
    const actionKey = `${queueKey}:${row.target}`;
    const bufferId = bufferIdByQueueKey.get(queueKey);
    const post = beforeById.get(bufferId);
    if (row.decision === 'REPURPOSE' && markers.applied.has(actionKey)) {
      if (post) throw new Error(`Checkpoint drift: ${actionKey} is marked applied but still scheduled.`);
      continue;
    }
    if (!post) throw new Error(`Live queue drift: ${queueKey} / ${bufferId} is no longer scheduled.`);
    if (post.channelId !== channelIds[row.target]) throw new Error(`Live queue drift: ${queueKey} changed target channel.`);
    const expectedDue = row.decision === 'MOVE' && markers.applied.has(actionKey) ? row.proposedDueAt : row.bufferDueAt;
    if (normalizeIso(post.dueAt) !== normalizeIso(expectedDue)) throw new Error(`Live queue drift: ${queueKey} dueAt is ${post.dueAt}, expected ${expectedDue}.`);
  }

  if (markers.applied.size === 0) {
    const sourceFailures = cadenceFailures(before, targetByChannel, policy, manifest.timezone || 'Europe/London');
    if (!sourceFailures.includes('2026-W35:main 7>5/week') || !sourceFailures.includes('2026-W35:secondary 7>5/week')) {
      throw new Error(`Initial preflight no longer matches #381 cadence defect: ${sourceFailures.join(', ') || 'none'}.`);
    }
  }

  for (const row of nonKeep) {
    const queueKey = `${row.id}@${row.revision}`;
    const actionKey = `${queueKey}:${row.target}`;
    const bufferId = bufferIdByQueueKey.get(queueKey);
    if (markers.applied.has(actionKey)) continue;

    if (!markers.intents.has(actionKey)) {
      await github.rest.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: `Migration intent locked before Buffer mutation: ${actionKey} · ${row.decision} · Buffer \`${bufferId}\`.\n<!-- BUFFER_MIGRATION_INTENT key=${actionKey} action=${row.decision} bufferId=${bufferId} -->`,
      });
      runComments = await github.paginate(github.rest.issues.listComments, { owner, repo, issue_number: issueNumber, per_page: 100 });
      markers = parseMigrationMarkers(runComments);
    }

    const current = await scheduledPosts();
    const currentPost = current.find((post) => post.id === bufferId);

    // Restart recovery: an INTENT exists but APPLIED may have failed to write after a successful Buffer mutation.
    if (markers.intents.has(actionKey) && !markers.applied.has(actionKey)) {
      if (row.decision === 'MOVE' && currentPost && normalizeIso(currentPost.dueAt) === normalizeIso(row.proposedDueAt)) {
        await github.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body: `✅ MOVE verified after interrupted run: ${actionKey} · Buffer \`${bufferId}\` · ${normalizeIso(row.proposedDueAt)}.\n<!-- BUFFER_MIGRATION_APPLIED key=${actionKey} action=MOVE bufferId=${bufferId} dueAt=${normalizeIso(row.proposedDueAt)} -->` });
        markers.applied.add(actionKey);
        continue;
      }
      if (row.decision === 'REPURPOSE' && !currentPost) {
        await github.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body: `✅ REPURPOSE removal verified after interrupted run: ${actionKey} · Buffer \`${bufferId}\` absent from scheduled queue; source preserved via \`${row.repurposeRoute}\`.\n<!-- BUFFER_MIGRATION_APPLIED key=${actionKey} action=REPURPOSE bufferId=${bufferId} -->` });
        markers.applied.add(actionKey);
        continue;
      }
    }

    if (!currentPost) throw new Error(`${actionKey} disappeared before mutation without a recoverable INTENT state.`);
    if (normalizeIso(currentPost.dueAt) !== normalizeIso(row.bufferDueAt)) throw new Error(`${actionKey} changed from its locked original time before mutation.`);

    if (row.decision === 'MOVE') {
      const dueAt = normalizeIso(row.proposedDueAt);
      const data = await buffer('mutation EditPost($input: EditPostInput!) { editPost(input: $input) { ... on PostActionSuccess { post { id dueAt status } } ... on MutationError { message } } }', {
        input: { id: bufferId, mode: 'customScheduled', dueAt },
      });
      if (!data.editPost?.post?.id) throw new Error(`${actionKey} Buffer edit failed: ${data.editPost?.message || 'no post returned'}`);
      if (data.editPost.post.id !== bufferId || normalizeIso(data.editPost.post.dueAt) !== dueAt) throw new Error(`${actionKey} Buffer edit readback did not match requested ID/time.`);
      await github.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body: `✅ MOVE applied: ${actionKey} · Buffer \`${bufferId}\` · ${row.bufferDueAt} → ${dueAt}\n<!-- BUFFER_MIGRATION_APPLIED key=${actionKey} action=MOVE bufferId=${bufferId} dueAt=${dueAt} -->` });
      markers.applied.add(actionKey);
    } else if (row.decision === 'REPURPOSE') {
      const data = await buffer('mutation DeletePost($input: DeletePostInput!) { deletePost(input: $input) { ... on DeletePostSuccess { id } ... on MutationError { message } } }', { input: { id: bufferId } });
      if (data.deletePost?.id !== bufferId) throw new Error(`${actionKey} Buffer delete failed: ${data.deletePost?.message || 'deleted ID not returned'}`);
      await github.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body: `✅ REPURPOSE removed from feed schedule: ${actionKey} · Buffer \`${bufferId}\` · source content preserved via \`${row.repurposeRoute}\`.\n<!-- BUFFER_MIGRATION_APPLIED key=${actionKey} action=REPURPOSE bufferId=${bufferId} -->` });
      markers.applied.add(actionKey);
    }
  }

  const after = await scheduledPosts();
  const afterById = new Map(after.map((post) => [post.id, post]));
  if (after.length !== manifest.summary.livePlacements - 2) throw new Error(`Post-write queue size is ${after.length}; expected ${manifest.summary.livePlacements - 2}.`);

  for (const row of manifest.placements.filter((row) => row.decision === 'KEEP')) {
    const bufferId = bufferIdByQueueKey.get(`${row.id}@${row.revision}`);
    const post = afterById.get(bufferId);
    if (!post || post.channelId !== channelIds[row.target] || normalizeIso(post.dueAt) !== normalizeIso(row.bufferDueAt)) throw new Error(`KEEP invariant failed for ${row.id}@${row.revision}.`);
  }
  for (const row of manifest.placements.filter((row) => row.decision === 'MOVE')) {
    const bufferId = bufferIdByQueueKey.get(`${row.id}@${row.revision}`);
    const post = afterById.get(bufferId);
    if (!post || normalizeIso(post.dueAt) !== normalizeIso(row.proposedDueAt)) throw new Error(`MOVE verification failed for ${row.id}@${row.revision}.`);
  }
  for (const row of manifest.placements.filter((row) => row.decision === 'REPURPOSE')) {
    const bufferId = bufferIdByQueueKey.get(`${row.id}@${row.revision}`);
    if (afterById.has(bufferId)) throw new Error(`REPURPOSE verification failed for ${row.id}@${row.revision}.`);
  }

  const finalFailures = cadenceFailures(after, targetByChannel, policy, manifest.timezone || 'Europe/London');
  if (finalFailures.length) throw new Error(`Post-write v1.12 cadence still fails: ${finalFailures.join(', ')}`);

  const counts = Object.fromEntries(Object.entries(channelIds).map(([target, id]) => [target, after.filter((post) => post.channelId === id).length]));
  const body = [
    '# Buffer migration applied and verified', '',
    `- Manifest blob: \`${EXPECTED_MANIFEST_BLOB_SHA}\``,
    '- Source snapshot: #381',
    '- Plan self-test: #382',
    `- Scheduled placements after: **${after.length}**`,
    `- Personal after: **${counts.personal || 0}**`,
    `- 222Emails company after: **${counts.main || 0}**`,
    `- Retention School after: **${counts.secondary || 0}**`,
    '- v1.12 daily/weekly cadence: **PASS**',
    '- KEEP invariants: **PASS**',
    '- MOVE same-ID readback: **PASS**',
    '- REPURPOSE schedule removal: **PASS**', '',
    'The two REPURPOSE source assets remain in the repository and migration manifest. Only the four explicitly classified live feed placements were changed.',
    '', `<!-- BUFFER_MIGRATION_COMPLETE id=${MIGRATION_ID} -->`,
  ].join('\n');
  await github.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body });
  await github.rest.issues.update({ owner, repo, issue_number: issueNumber, state: 'closed', state_reason: 'completed' });
  if (core?.summary) core.summary.addHeading('Buffer migration').addRaw(body).write();
  return { afterCount: after.length, counts, finalFailures };
}

module.exports = {
  EXPECTED_MANIFEST_BLOB_SHA,
  MANIFEST_PATH,
  MIGRATION_ID,
  cadenceFailures,
  localDate,
  normalizeIso,
  parseBufferIdFromComments,
  parseHeaders,
  parseMigrationMarkers,
  run,
  validateManifest,
  weekKey,
};
