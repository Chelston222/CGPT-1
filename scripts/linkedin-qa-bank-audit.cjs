'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DEFAULT_CADENCE_POLICY, localDate, weekKeyFromLocalDate } = require('./linkedin-buffer-capacity.cjs');
const { jaccardSimilarity } = require('./linkedin-performance-learning-v2.cjs');

const ROOT = path.join(__dirname, '..');
const REVIEW_DIR = path.join(ROOT, 'apps', 'linkedin-review');
const QUEUE_PATH = path.join(REVIEW_DIR, 'queue.json');
const DISTRIBUTION_PATH = path.join(REVIEW_DIR, 'distribution-policy.json');

function words(text = '') {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

function dateOnly(value) {
  return String(value || '').slice(0, 10);
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function promotionContract(post = {}) {
  return {
    id: post.id ?? null,
    revision: post.revision ?? null,
    title: post.title ?? null,
    category: post.category ?? null,
    contentRole: post.contentRole ?? null,
    funnelStage: post.funnelStage ?? null,
    format: post.format ?? null,
    targets: post.targets ?? null,
    mode: post.mode ?? null,
    scheduledAt: post.scheduledAt ?? null,
    taxonomy: post.taxonomy ?? null,
    copy: post.copy ?? null,
    sourceType: post.sourceType ?? null,
    status: post.status ?? null,
    qa: post.qa ?? null,
  };
}

function promotionMatchesQueue(qaPost, queuePost) {
  return JSON.stringify(promotionContract(qaPost)) === JSON.stringify(promotionContract(queuePost));
}

function auditQaBanks() {
  const errors = [];
  const warnings = [];
  const legacyDebt = [];
  const exactPromotions = [];
  const queue = loadJson(QUEUE_PATH);
  const distribution = loadJson(DISTRIBUTION_PATH);
  const files = fs.readdirSync(REVIEW_DIR).filter((name) => /^qa-replenishment-.*\.json$/.test(name)).sort();
  const queueById = new Map();
  const qaIds = new Map();
  const currentCopies = [];
  const fileSummaries = [];

  for (const post of queue.posts || []) {
    if (!post?.id) continue;
    if (queueById.has(post.id)) {
      errors.push(`queue.json/${post.id}: duplicate post id already exists in queue.json.`);
      continue;
    }
    queueById.set(post.id, post);
  }

  for (const name of files) {
    const fullPath = path.join(REVIEW_DIR, name);
    let payload;
    try {
      payload = loadJson(fullPath);
    } catch (error) {
      errors.push(`${name}: invalid JSON: ${error.message}`);
      continue;
    }

    if (!Number.isInteger(payload.schemaVersion)) errors.push(`${name}: schemaVersion must be an integer.`);
    if (!Array.isArray(payload.posts)) errors.push(`${name}: posts must be an array.`);
    if (!Array.isArray(payload.posts)) continue;

    const currentPolicy = payload.posts.length > 0 && payload.posts.every((post) => post.sourceType === 'performance_learning_v2');
    const slotKeys = new Set();
    const daily = new Map();
    const weekly = new Map();
    let currentPosts = 0;

    for (const post of payload.posts) {
      const prefix = `${name}/${post.id || '<missing-id>'}`;
      const postIsCurrent = post.sourceType === 'performance_learning_v2';
      if (postIsCurrent) currentPosts += 1;

      // Universal integrity checks. These protect dynamic discovery regardless of age.
      if (!/^[a-z0-9-]+$/.test(String(post.id || ''))) errors.push(`${prefix}: id must be lowercase kebab-case.`);
      if (!Number.isInteger(post.revision) || post.revision < 1) errors.push(`${prefix}: revision must be a positive integer.`);
      if (!post.title || !String(post.title).trim()) errors.push(`${prefix}: title is required.`);
      if (!post.category || !String(post.category).trim()) errors.push(`${prefix}: category is required.`);
      if (!['text', 'image', 'carousel', 'visual'].includes(String(post.format || ''))) errors.push(`${prefix}: unsupported format ${post.format}.`);
      if (!Array.isArray(post.targets) || !post.targets.length) errors.push(`${prefix}: at least one target is required.`);
      if (!['schedule', 'queue'].includes(post.mode)) errors.push(`${prefix}: mode must be schedule or queue.`);
      if (post.status !== 'review') errors.push(`${prefix}: status must remain review in QA banks.`);
      if (post.qa?.status !== 'ready_for_human_review' || post.qa?.approvalEligible !== true || post.qa?.publishPermission !== false) errors.push(`${prefix}: QA flags must be ready_for_human_review / approvalEligible true / publishPermission false.`);
      const copy = post.copy?.default || '';
      if (!String(copy).trim()) errors.push(`${prefix}: copy.default is required.`);

      // A QA record may exist in queue.json only after promotion. That is healthy only when the
      // complete governed release contract is byte-for-byte equivalent at the structured-field level.
      // Any drift remains a hard failure so reconciliation cannot hide a changed revision, target,
      // schedule, copy or QA state. Duplicate IDs across separate QA banks remain prohibited.
      if (qaIds.has(post.id)) {
        errors.push(`${prefix}: duplicate QA post id already defined in ${qaIds.get(post.id)}.`);
      } else {
        qaIds.set(post.id, name);
      }
      const queued = queueById.get(post.id);
      if (queued) {
        if (promotionMatchesQueue(post, queued)) exactPromotions.push(`${prefix}: exact promoted queue record.`);
        else errors.push(`${prefix}: post id exists in queue.json but the promoted release contract has drifted.`);
      }

      // Current-policy content rules. Historical content is preserved as historical evidence.
      if (postIsCurrent) {
        if (String(copy).includes('—')) errors.push(`${prefix}: em dash is prohibited.`);
        if (/\b222 Emails\b/.test(String(copy))) errors.push(`${prefix}: use 222Emails, not 222 Emails.`);
        if (/\bTriple Two Emails\b/.test(String(copy)) && !(post.targets || []).includes('personal')) warnings.push(`${prefix}: spoken-name styling appears outside personal copy; confirm it is intentional.`);
        const count = words(copy);
        if (count < 45) errors.push(`${prefix}: v2 copy is too thin at ${count} words.`);
        if (count > 280) errors.push(`${prefix}: v2 copy is too long at ${count} words.`);
        if (!post.contentRole) errors.push(`${prefix}: v2 contentRole is required.`);
        currentCopies.push({ name, id: post.id, copy });
      } else {
        if (String(copy).includes('—')) legacyDebt.push(`${prefix}: historical em dash retained.`);
        if (/\b222 Emails\b/.test(String(copy))) legacyDebt.push(`${prefix}: historical 222 Emails naming retained.`);
      }

      for (const target of post.targets || []) {
        if (!['personal', 'main', 'secondary'].includes(target)) errors.push(`${prefix}: unknown target ${target}.`);
        const schedule = post.scheduledAt?.[target];
        if (!schedule || Number.isNaN(Date.parse(schedule))) {
          errors.push(`${prefix}: valid scheduledAt.${target} is required.`);
          continue;
        }
        const date = dateOnly(schedule);
        if (payload.weekStart && date < payload.weekStart) errors.push(`${prefix}: ${target} schedule is before weekStart.`);
        if (payload.weekEnd && date > payload.weekEnd) errors.push(`${prefix}: ${target} schedule is after weekEnd.`);
        const slot = `${target}:${schedule}`;
        if (slotKeys.has(slot)) errors.push(`${prefix}: duplicate ${target} schedule slot ${schedule}.`);
        slotKeys.add(slot);
        const local = localDate(schedule, distribution.timezone || 'Europe/London');
        const dayKey = `${local}:${target}`;
        const weekKey = `${weekKeyFromLocalDate(local)}:${target}`;
        daily.set(dayKey, (daily.get(dayKey) || 0) + 1);
        weekly.set(weekKey, (weekly.get(weekKey) || 0) + 1);

        if (postIsCurrent) {
          const allowedRoles = distribution.accounts?.[target]?.allowedContentRoles || [];
          if (!allowedRoles.includes(post.contentRole)) errors.push(`${prefix}: contentRole ${post.contentRole} is not allowed for ${target}.`);
          if (target === 'secondary') {
            const taxonomy = post.taxonomy || {};
            for (const key of ['category', 'season', 'lesson_or_resource']) if (!taxonomy[key]) errors.push(`${prefix}: Retention School taxonomy.${key} is required.`);
          }
        }
      }
    }

    // Only banks authored under the current policy are required to satisfy the current cadence.
    // Historical banks remain immutable evidence and are surfaced as legacy debt instead.
    for (const [key, count] of daily) {
      const target = key.split(':').at(-1);
      const max = DEFAULT_CADENCE_POLICY[target]?.maxPerDay;
      if (Number.isFinite(max) && count > max) {
        const message = `${name}: ${key} has ${count} placements; current cadence maximum is ${max}.`;
        if (currentPolicy) errors.push(message); else legacyDebt.push(message);
      }
    }
    for (const [key, count] of weekly) {
      const target = key.split(':').at(-1);
      const max = DEFAULT_CADENCE_POLICY[target]?.maxPerWeek;
      if (Number.isFinite(max) && count > max) {
        const message = `${name}: ${key} has ${count} placements; current weekly cadence maximum is ${max}.`;
        if (currentPolicy) errors.push(message); else legacyDebt.push(message);
      }
    }

    fileSummaries.push({ name, posts: payload.posts.length, currentPolicy, currentPosts });
  }

  for (let i = 0; i < currentCopies.length; i += 1) {
    for (let j = i + 1; j < currentCopies.length; j += 1) {
      const a = currentCopies[i];
      const b = currentCopies[j];
      const similarity = jaccardSimilarity(a.copy, b.copy);
      if (similarity >= 0.72) errors.push(`${a.name}/${a.id} and ${b.name}/${b.id} are too textually similar (${similarity.toFixed(3)}).`);
      else if (similarity >= 0.60) warnings.push(`${a.name}/${a.id} and ${b.name}/${b.id} are moderately similar (${similarity.toFixed(3)}).`);
    }
  }

  return {
    ok: errors.length === 0,
    files: fileSummaries,
    errors,
    warnings,
    legacyDebt,
    exactPromotions,
    totalQaFiles: fileSummaries.length,
    totalQaPosts: fileSummaries.reduce((sum, row) => sum + row.posts, 0),
    currentPolicyFiles: fileSummaries.filter((row) => row.currentPolicy).length,
    currentPolicyPosts: currentCopies.length,
  };
}

if (require.main === module) {
  const result = auditQaBanks();
  if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`LinkedIn QA bank audit: ${result.ok ? 'PASS' : 'FAIL'}`);
    console.log(`QA files: ${result.totalQaFiles}; QA posts: ${result.totalQaPosts}; current-policy posts: ${result.currentPolicyPosts}; exact promotions: ${result.exactPromotions.length}; legacy debt: ${result.legacyDebt.length}`);
    for (const warning of result.warnings) console.log(`WARN: ${warning}`);
    for (const error of result.errors) console.error(`ERROR: ${error}`);
  }
  if (!result.ok) process.exitCode = 1;
}

module.exports = { auditQaBanks, promotionContract, promotionMatchesQueue };
