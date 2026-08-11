'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { validateRequest } = require('./linkedin-review-core.cjs');
const { validateDailyPlacementLimit } = require('./linkedin-buffer-capacity.cjs');

const QA_REPLENISHMENT_PATH = path.join(__dirname, '..', 'apps', 'linkedin-review', 'qa-replenishment-2026-08-11.json');

function withQaReplenishment(queue) {
  let supplemental = { posts: [] };
  try {
    supplemental = JSON.parse(fs.readFileSync(QA_REPLENISHMENT_PATH, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const existingIds = new Set((queue.posts || []).map((post) => post.id));
  const additions = (supplemental.posts || []).filter((post) =>
    !existingIds.has(post.id)
    && post.status === 'review'
    && post.qa?.status === 'ready_for_human_review'
    && post.qa?.approvalEligible === true
    && post.qa?.publishPermission === false
  );
  return { ...queue, posts: [...(queue.posts || []), ...additions] };
}

function parseHeaders(body = '') {
  const header = {};
  for (const line of String(body).split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]+):\s*(.*)$/);
    if (match) header[match[1]] = match[2].trim();
  }
  return header;
}

function parseItems(value = '') {
  if (!String(value).trim()) return [];
  const items = String(value).split(',').map((item) => item.trim()).filter(Boolean).map((item) => {
    const match = item.match(/^([a-z0-9-]+)@(\d+)$/i);
    if (!match) throw new Error(`Invalid locked item "${item}". Expected post-id@revision.`);
    return { id: match[1], revision: Number(match[2]) };
  });
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw new Error('A post cannot appear more than once in APPROVED_ITEMS.');
  }
  return items;
}

function dateOnly(value) {
  return String(value).slice(0, 10);
}

function addDays(value, days) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function postBody(post) {
  const lines = [
    `POST_ID: ${post.id}`,
    `REVISION: ${post.revision}`,
    `CATEGORY: ${post.category}`,
    `TARGETS: ${post.targets.join(',')}`,
    `MODE: ${post.mode}`,
  ];
  const schedules = Object.entries(post.scheduledAt || {});
  if (schedules.length === 1) lines.push(`SCHEDULE_AT: ${schedules[0][1]}`);
  else schedules.forEach(([target, value]) => lines.push(`SCHEDULE_AT_${target.toUpperCase()}: ${value}`));
  lines.push(`MEDIA_URL: ${post.mediaUrl || ''}`, '---', post.copy?.default || '');
  if (post.mediaUrl) {
    lines.splice(lines.length - 2, 0, `MEDIA_KIND: ${post.format === 'carousel' ? 'document' : 'image'}`);
    if (post.format === 'carousel') lines.splice(lines.length - 2, 0, `DOCUMENT_TITLE: ${post.documentTitle || post.title || post.id}`);
    if (post.format === 'carousel') lines.splice(lines.length - 2, 0, `DOCUMENT_THUMBNAIL_URL: ${post.documentThumbnailUrl || ''}`);
  }
  for (const target of post.targets) {
    if (post.copy?.[target]) lines.push(`---${target.toUpperCase()}---`, post.copy[target]);
  }
  return lines.join('\n');
}

function validateWeeklyBatch(body, queue, env = {}, now = Date.now(), options = {}) {
  const header = parseHeaders(body);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(header.WEEK_START || '')) {
    throw new Error('WEEK_START must be a Monday in YYYY-MM-DD format.');
  }
  const startDate = new Date(`${header.WEEK_START}T12:00:00Z`);
  if ((startDate.getUTCDay() || 7) !== 1) throw new Error('WEEK_START must be a Monday.');
  if (String(header.QUEUE_SCHEMA) !== String(queue.schemaVersion)) {
    throw new Error('The queue schema changed after review. Review this week again.');
  }
  if (header.QUEUE_GENERATED_AT !== queue.generatedAt && !options.allowGeneratedAtDrift) {
    throw new Error('The queue changed after review. Review this week again.');
  }

  const approved = parseItems(header.APPROVED_ITEMS);
  if (!approved.length) throw new Error('APPROVED_ITEMS must contain at least one locked post.');
  const effectiveQueue = withQaReplenishment(queue);
  const queueById = new Map(effectiveQueue.posts.map((post) => [post.id, post]));
  const weekEnd = addDays(header.WEEK_START, 6);

  const jobs = approved.map((locked) => {
    const post = queueById.get(locked.id);
    if (!post) throw new Error(`${locked.id} is not present in the locked queue or QA replenishment.`);
    if (Number(post.revision) !== locked.revision) {
      throw new Error(`${locked.id} changed revision after review. Review it again.`);
    }
    if (!['schedule', 'queue'].includes(post.mode)) {
      throw new Error(`${locked.id} is not configured for live scheduling.`);
    }
    if (post.format === 'carousel' && (post.carousel?.readiness !== 'ready' || !post.mediaUrl || !post.documentThumbnailUrl)) {
      throw new Error(`${locked.id} carousel PDF and public thumbnail are not verified and publishable.`);
    }
    for (const target of post.targets) {
      const scheduled = post.scheduledAt?.[target];
      const scheduledDate = dateOnly(scheduled);
      if (!scheduled || scheduledDate < header.WEEK_START || scheduledDate > weekEnd) {
        throw new Error(`${locked.id} has a ${target} schedule outside the approved week.`);
      }
    }
    return { post, request: validateRequest(postBody(post), env, now) };
  });

  const placementsByDay = validateDailyPlacementLimit(jobs);

  return {
    batchId: header.BATCH_ID || `linkedin-week-${header.WEEK_START}`,
    weekStart: header.WEEK_START,
    weekEnd,
    jobs,
    placementsByDay,
  };
}

module.exports = { parseHeaders, parseItems, postBody, validateWeeklyBatch, withQaReplenishment };
