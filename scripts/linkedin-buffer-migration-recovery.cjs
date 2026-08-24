'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  EXPECTED_MANIFEST_BLOB_SHA,
  MIGRATION_ID,
  MANIFEST_PATH,
  cadenceFailures,
  normalizeIso,
  parseBufferIdFromComments,
  parseHeaders,
  parseMigrationMarkers,
  validateManifest,
} = require('./linkedin-buffer-migration-apply.cjs');
const { withQaReplenishment } = require('./linkedin-week-batch.cjs');

const SOURCE_APPROVAL_ISSUE = 386;
const SOURCE_PROGRESS_SNAPSHOT_ISSUE = 387;

function lockedMoveCopy(workspace, manifest) {
  const baseQueue = JSON.parse(fs.readFileSync(path.join(workspace, 'apps/linkedin-review/queue.json'), 'utf8'));
  const effectiveQueue = withQaReplenishment(baseQueue);
  const effectiveByKey = new Map((effectiveQueue.posts || []).map((post) => [`${post.id}@${post.revision}`, post]));
  const locked = new Map();

  for (const row of manifest.placements.filter((item) => item.decision === 'MOVE')) {
    const key = `${row.id}@${row.revision}`;
    const post = effectiveByKey.get(key);
    if (!post) throw new Error(`${key} is missing from the effective locked queue.`);
    if (!(post.targets || []).includes(row.target)) throw new Error(`${key} no longer targets ${row.target}.`);
    const originalScheduledAt = post.scheduledAt?.[row.target];
    if (!originalScheduledAt || normalizeIso(originalScheduledAt) !== normalizeIso(row.bufferDueAt)) {
      throw new Error(`${key} locked queue time no longer matches the migration source snapshot.`);
    }
    if (post.mediaUrl) throw new Error(`${key} MOVE unexpectedly contains media; text-preserving recovery only supports the locked text-only rows.`);
    const text = post.copy?.[row.target] || post.copy?.default;
    if (!String(text || '').trim()) throw new Error(`${key} has no exact locked text to preserve during Buffer edit.`);
    locked.set(key, { post, text: String(text) });
  }
  return locked;
}

async function run({ github, context, core, env = process.env, workspace = process.env.GITHUB_WORKSPACE, now = Date.now() }) {
  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const recoveryIssue = context.issue.number;
  const manifest = JSON.parse(fs.readFileSync(path.join(workspace, MANIFEST_PATH), 'utf8'));
  const policy = JSON.parse(fs.readFileSync(path.join(workspace, 'apps/linkedin-review/distribution-policy.json'), 'utf8'));
  const nonKeep = validateManifest(manifest);
  const moveCopy = lockedMoveCopy(workspace, manifest);

  const approval = parseHeaders(context.payload.issue.body || '');
  if (approval.MIGRATION_ID !== MIGRATION_ID) throw new Error('MIGRATION_ID does not match the locked migration.');
  if (approval.MANIFEST_BLOB_SHA !== EXPECTED_MANIFEST_BLOB_SHA) throw new Error('MANIFEST_BLOB_SHA does not match the locked manifest revision.');
  if (approval.SOURCE_APPROVAL_ISSUE !== String(SOURCE_APPROVAL_ISSUE)) throw new Error(`SOURCE_APPROVAL_ISSUE must be ${SOURCE_APPROVAL_ISSUE}.`);
  if (approval.SOURCE_PROGRESS_SNAPSHOT_ISSUE !== String(SOURCE_PROGRESS_SNAPSHOT_ISSUE)) throw new Error(`SOURCE_PROGRESS_SNAPSHOT_ISSUE must be ${SOURCE_PROGRESS_SNAPSHOT_ISSUE}.`);
  if (approval.APPLY_REMAINDER !== 'YES') throw new Error('APPLY_REMAINDER: YES is required.');

  const originalIssue = await github.rest.issues.get({ owner, repo, issue_number: SOURCE_APPROVAL_ISSUE });
  const originalApproval = parseHeaders(originalIssue.data.body || '');
  if (originalApproval.MIGRATION_ID !== MIGRATION_ID || originalApproval.MANIFEST_BLOB_SHA !== EXPECTED_MANIFEST_BLOB_SHA || originalApproval.APPLY !== 'YES') {
    throw new Error('Source approval issue no longer contains the exact locked migration approval.');
  }

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
    const account = await buffer('query MigrationRecoveryAccount { account { organizations { id } } }');
    const organizationId = account.account?.organizations?.[0]?.id;
    if (!organizationId) throw new Error('Buffer returned no organisation ID.');
    const data = await buffer(`query MigrationRecoveryScheduled { posts(first: 100, input: { organizationId: ${JSON.stringify(organizationId)}, filter: { status: [scheduled], channelIds: ${JSON.stringify(Object.values(channelIds))} } }) { edges { node { id channelId dueAt status } } pageInfo { hasNextPage } } }`);
    if (data.posts?.pageInfo?.hasNextPage) throw new Error('Buffer scheduled-post query exceeds 100 rows; refusing incomplete recovery evidence.');
    return (data.posts?.edges || []).map((edge) => edge.node);
  }

  for (const row of nonKeep) {
    if (row.decision === 'MOVE' && Date.parse(row.proposedDueAt) <= now + 60 * 60 * 1000) throw new Error(`${row.id} proposed due time is too close or passed; re-plan.`);
  }

  const bufferIdByQueueKey = new Map();
  for (const row of manifest.placements) {
    const comments = await github.paginate(github.rest.issues.listComments, { owner, repo, issue_number: row.approvalIssue, per_page: 100 });
    const bufferId = parseBufferIdFromComments(comments, row);
    if (!bufferId) throw new Error(`Could not recover Buffer ID for ${row.id}@${row.revision} from approval issue #${row.approvalIssue}.`);
    bufferIdByQueueKey.set(`${row.id}@${row.revision}`, bufferId);
  }

  let sourceComments = await github.paginate(github.rest.issues.listComments, { owner, repo, issue_number: SOURCE_APPROVAL_ISSUE, per_page: 100 });
  let sourceMarkers = parseMigrationMarkers(sourceComments);

  async function recordSource(body) {
    await github.rest.issues.createComment({ owner, repo, issue_number: SOURCE_APPROVAL_ISSUE, body });
    sourceComments = await github.paginate(github.rest.issues.listComments, { owner, repo, issue_number: SOURCE_APPROVAL_ISSUE, per_page: 100 });
    sourceMarkers = parseMigrationMarkers(sourceComments);
  }

  const before = await scheduledPosts();
  if (before.length < 24 || before.length > 25) throw new Error(`Recovery checkpoint expected 24-25 scheduled placements; found ${before.length}.`);
  const beforeById = new Map(before.map((post) => [post.id, post]));

  for (const row of manifest.placements.filter((item) => item.decision === 'KEEP')) {
    const bufferId = bufferIdByQueueKey.get(`${row.id}@${row.revision}`);
    const post = beforeById.get(bufferId);
    if (!post || post.channelId !== channelIds[row.target] || normalizeIso(post.dueAt) !== normalizeIso(row.bufferDueAt)) {
      throw new Error(`KEEP invariant failed before recovery for ${row.id}@${row.revision}.`);
    }
  }

  const recovered = [];
  for (const row of nonKeep) {
    const queueKey = `${row.id}@${row.revision}`;
    const actionKey = `${queueKey}:${row.target}`;
    const bufferId = bufferIdByQueueKey.get(queueKey);
    const current = await scheduledPosts();
    const currentPost = current.find((post) => post.id === bufferId);

    if (row.decision === 'REPURPOSE' && !currentPost) {
      if (!sourceMarkers.applied.has(actionKey)) {
        await recordSource(`✅ REPURPOSE removal verified during recovery: ${actionKey} · Buffer \`${bufferId}\` is absent from the scheduled queue; source preserved via \`${row.repurposeRoute}\`.\n<!-- BUFFER_MIGRATION_APPLIED key=${actionKey} action=REPURPOSE bufferId=${bufferId} recovery=1 -->`);
      }
      recovered.push(`${actionKey}=already_absent`);
      continue;
    }

    if (row.decision === 'MOVE' && currentPost && normalizeIso(currentPost.dueAt) === normalizeIso(row.proposedDueAt)) {
      if (!sourceMarkers.applied.has(actionKey)) {
        await recordSource(`✅ MOVE verified during recovery: ${actionKey} · Buffer \`${bufferId}\` already at ${normalizeIso(row.proposedDueAt)}.\n<!-- BUFFER_MIGRATION_APPLIED key=${actionKey} action=MOVE bufferId=${bufferId} dueAt=${normalizeIso(row.proposedDueAt)} recovery=1 -->`);
      }
      recovered.push(`${actionKey}=already_moved`);
      continue;
    }

    if (!currentPost) throw new Error(`${actionKey} is missing without a valid REPURPOSE terminal state.`);
    if (currentPost.channelId !== channelIds[row.target]) throw new Error(`${actionKey} changed target channel.`);
    if (normalizeIso(currentPost.dueAt) !== normalizeIso(row.bufferDueAt)) throw new Error(`${actionKey} is neither at its locked original time nor its approved recovery state.`);

    if (!sourceMarkers.intents.has(actionKey)) {
      await recordSource(`Migration recovery intent locked before Buffer mutation: ${actionKey} · ${row.decision} · Buffer \`${bufferId}\`.\n<!-- BUFFER_MIGRATION_INTENT key=${actionKey} action=${row.decision} bufferId=${bufferId} recovery=1 -->`);
    }

    if (row.decision === 'MOVE') {
      const dueAt = normalizeIso(row.proposedDueAt);
      const exactText = moveCopy.get(queueKey)?.text;
      if (!String(exactText || '').trim()) throw new Error(`${actionKey} exact locked text is unavailable.`);
      const data = await buffer('mutation EditPost($input: EditPostInput!) { editPost(input: $input) { ... on PostActionSuccess { post { id dueAt status } } ... on MutationError { message } } }', {
        input: { id: bufferId, mode: 'customScheduled', dueAt, schedulingType: 'automatic', text: exactText },
      });
      if (!data.editPost?.post?.id) throw new Error(`${actionKey} Buffer edit failed: ${data.editPost?.message || 'no post returned'}`);
      if (data.editPost.post.id !== bufferId || normalizeIso(data.editPost.post.dueAt) !== dueAt) throw new Error(`${actionKey} Buffer edit readback did not match requested ID/time.`);
      await recordSource(`✅ MOVE applied during recovery with exact locked text preserved: ${actionKey} · Buffer \`${bufferId}\` · ${row.bufferDueAt} → ${dueAt}\n<!-- BUFFER_MIGRATION_APPLIED key=${actionKey} action=MOVE bufferId=${bufferId} dueAt=${dueAt} recovery=1 exactText=locked -->`);
      recovered.push(`${actionKey}=moved`);
    } else if (row.decision === 'REPURPOSE') {
      const data = await buffer('mutation DeletePost($input: DeletePostInput!) { deletePost(input: $input) { ... on DeletePostSuccess { id } ... on MutationError { message } } }', { input: { id: bufferId } });
      if (data.deletePost?.id !== bufferId) throw new Error(`${actionKey} Buffer delete failed: ${data.deletePost?.message || 'deleted ID not returned'}`);
      await recordSource(`✅ REPURPOSE removed during recovery: ${actionKey} · Buffer \`${bufferId}\` · source content preserved via \`${row.repurposeRoute}\`.\n<!-- BUFFER_MIGRATION_APPLIED key=${actionKey} action=REPURPOSE bufferId=${bufferId} recovery=1 -->`);
      recovered.push(`${actionKey}=repurposed`);
    }
  }

  const after = await scheduledPosts();
  const afterById = new Map(after.map((post) => [post.id, post]));
  if (after.length !== 24) throw new Error(`Post-recovery queue size is ${after.length}; expected 24.`);

  for (const row of manifest.placements.filter((item) => item.decision === 'KEEP')) {
    const bufferId = bufferIdByQueueKey.get(`${row.id}@${row.revision}`);
    const post = afterById.get(bufferId);
    if (!post || post.channelId !== channelIds[row.target] || normalizeIso(post.dueAt) !== normalizeIso(row.bufferDueAt)) throw new Error(`KEEP invariant failed after recovery for ${row.id}@${row.revision}.`);
  }
  for (const row of manifest.placements.filter((item) => item.decision === 'MOVE')) {
    const bufferId = bufferIdByQueueKey.get(`${row.id}@${row.revision}`);
    const post = afterById.get(bufferId);
    if (!post || post.channelId !== channelIds[row.target] || normalizeIso(post.dueAt) !== normalizeIso(row.proposedDueAt)) throw new Error(`MOVE verification failed after recovery for ${row.id}@${row.revision}.`);
  }
  for (const row of manifest.placements.filter((item) => item.decision === 'REPURPOSE')) {
    const bufferId = bufferIdByQueueKey.get(`${row.id}@${row.revision}`);
    if (afterById.has(bufferId)) throw new Error(`REPURPOSE verification failed after recovery for ${row.id}@${row.revision}.`);
  }

  const finalFailures = cadenceFailures(after, targetByChannel, policy, manifest.timezone || 'Europe/London');
  if (finalFailures.length) throw new Error(`Post-recovery v1.12 cadence still fails: ${finalFailures.join(', ')}`);

  const counts = Object.fromEntries(Object.entries(channelIds).map(([target, id]) => [target, after.filter((post) => post.channelId === id).length]));
  const summary = [
    '# Buffer migration recovery complete', '',
    '✅ Exact locked v1.12 migration is now reflected in live Buffer.', '',
    `- Scheduled placements: **${after.length}**`,
    `- Personal: **${counts.personal}**`,
    `- 222Emails company: **${counts.main}**`,
    `- Retention School: **${counts.secondary}**`,
    '- v1.12 cadence: **PASS**',
    '- KEEP invariants: **PASS**',
    '- MOVE verification: **PASS**',
    '- REPURPOSE verification: **PASS**',
    '- MOVE copy contract: **exact locked text preserved**',
    `- Recovery actions: ${recovered.join(', ')}`,
  ].join('\n');

  await github.rest.issues.createComment({ owner, repo, issue_number: SOURCE_APPROVAL_ISSUE, body: summary });
  await github.rest.issues.createComment({ owner, repo, issue_number: recoveryIssue, body: summary });
  await github.rest.issues.update({ owner, repo, issue_number: SOURCE_APPROVAL_ISSUE, state: 'closed', state_reason: 'completed' });
  await github.rest.issues.update({ owner, repo, issue_number: recoveryIssue, state: 'closed', state_reason: 'completed' });
  if (core?.summary) core.summary.addHeading('Buffer migration recovery').addRaw(summary).write();
  return { after, counts, recovered };
}

module.exports = {
  SOURCE_APPROVAL_ISSUE,
  SOURCE_PROGRESS_SNAPSHOT_ISSUE,
  lockedMoveCopy,
  run,
};
