#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BUFFER_API_URL = 'https://api.buffer.com';
const DEFAULT_OUT_DIR = 'apps/linkedin-review/data';
const TARGETS = [
  ['personal', 'Chelston · Personal', 'BUFFER_LINKEDIN_PERSONAL_CHANNEL_ID'],
  ['main', '222 Emails · Main', 'BUFFER_LINKEDIN_BUSINESS_CHANNEL_ID'],
  ['secondary', 'TTE · Secondary', 'BUFFER_LINKEDIN_SECONDARY_CHANNEL_ID'],
];

const outDir = process.argv[2] || DEFAULT_OUT_DIR;
const apiKey = process.env.BUFFER_API_KEY;
if (!apiKey) throw new Error('BUFFER_API_KEY is not configured.');

function presentChannels() {
  return TARGETS
    .map(([target, label, env]) => ({ target, label, env, id: process.env[env] }))
    .filter((channel) => Boolean(channel.id));
}

const channels = presentChannels();
if (!channels.length) throw new Error('No Buffer LinkedIn channel IDs are configured.');

function csvEscape(value) {
  const text = String(value ?? '');
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows, columns) {
  return [
    columns.map(csvEscape).join(','),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(',')),
  ].join('\n');
}

function truncate(value, max = 260) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

async function buffer(query) {
  const response = await fetch(BUFFER_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query }),
  });
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Buffer returned HTTP ${response.status} with a non-JSON body.`);
  }
  if (!response.ok || payload.errors?.length) {
    const message = (payload.errors || []).map((error) => error.message).filter(Boolean).join('; ');
    throw new Error(message || `Buffer returned HTTP ${response.status}.`);
  }
  return payload.data;
}

async function organisationId() {
  const data = await buffer('query AnalyticsAccount { account { organizations { id } } }');
  const id = data.account?.organizations?.[0]?.id;
  if (!id) throw new Error('Buffer did not return an organisation ID.');
  return id;
}

function postsQuery({ organizationId, status }) {
  const channelIds = channels.map((channel) => channel.id);
  return `query BufferPosts {
    posts(
      first: 100
      input: {
        organizationId: ${JSON.stringify(organizationId)}
        filter: { status: [${status}], channelIds: ${JSON.stringify(channelIds)} }
      }
    ) {
      edges {
        node {
          id
          text
          createdAt
          dueAt
          channelId
          status
          metrics {
            type
            name
            value
            unit
          }
          metricsUpdatedAt
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }`;
}

async function fetchPosts(organizationId, status) {
  const data = await buffer(postsQuery({ organizationId, status }));
  return {
    posts: (data.posts?.edges || []).map((edge) => edge.node).filter(Boolean),
    truncated: Boolean(data.posts?.pageInfo?.hasNextPage),
  };
}

const channelById = Object.fromEntries(channels.map((channel) => [channel.id, channel]));

function normaliseMetric(metric) {
  return {
    type: String(metric?.type || ''),
    name: String(metric?.name || ''),
    value: Number(metric?.value || 0),
    unit: String(metric?.unit || ''),
  };
}

function metricValue(post, names) {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  return (post.metrics || [])
    .map(normaliseMetric)
    .filter((metric) => wanted.has(metric.type.toLowerCase()) || wanted.has(metric.name.toLowerCase()))
    .reduce((sum, metric) => sum + metric.value, 0);
}

function normalisePost(post) {
  const channel = channelById[post.channelId] || { target: 'unknown', label: post.channelId || 'Unknown channel' };
  const reactions = metricValue(post, ['reactions', 'likes', 'favorites']);
  const comments = metricValue(post, ['comments']);
  const shares = metricValue(post, ['shares', 'retweets', 'reposts']);
  const clicks = metricValue(post, ['clicks', 'linkClicks']);
  const impressions = metricValue(post, ['impressions', 'reach']);
  const views = metricValue(post, ['views', 'videoViews']);
  const score = reactions + comments * 3 + shares * 4 + clicks * 2 + Math.round((impressions + views) / 100);
  return {
    id: post.id,
    channelId: post.channelId,
    target: channel.target,
    channel: channel.label,
    status: post.status,
    dueAt: post.dueAt,
    createdAt: post.createdAt,
    text: post.text || '',
    textPreview: truncate(post.text, 220),
    metrics: (post.metrics || []).map(normaliseMetric),
    metricsUpdatedAt: post.metricsUpdatedAt || null,
    kpi: { reactions, comments, shares, clicks, impressions, views, score },
  };
}

function withinDays(value, days) {
  const time = Date.parse(value || '');
  if (!Number.isFinite(time)) return false;
  return time >= Date.now() - days * 86_400_000;
}

function totals(posts) {
  return posts.reduce((acc, post) => {
    for (const [key, value] of Object.entries(post.kpi)) acc[key] = (acc[key] || 0) + Number(value || 0);
    return acc;
  }, { reactions: 0, comments: 0, shares: 0, clicks: 0, impressions: 0, views: 0, score: 0 });
}

function buildActions({ scheduled, sent, topPosts, weakPosts, warnings }) {
  const actions = [];
  if (warnings.length) actions.push('Fix analytics warning before trusting the full dashboard: ' + warnings[0]);
  if (!sent.length) actions.push('No sent Buffer posts were returned yet. Keep posting, then rerun after the first posts publish.');
  if (topPosts[0]) actions.push(`Repurpose the current winner from ${topPosts[0].channel}: ${truncate(topPosts[0].textPreview, 140)}`);
  if (weakPosts.length) actions.push(`Rewrite the weakest ${Math.min(3, weakPosts.length)} posts with a sharper hook, clearer pain point and one specific ask.`);
  if (scheduled.length < channels.length * 10) actions.push('Build the next approval batch because the scheduled runway is below the 10-post-per-channel Buffer window.');
  const noCommentPosts = sent.filter((post) => post.kpi.comments === 0).length;
  if (noCommentPosts >= 3) actions.push('Add more comment-driving closes. Ask one direct question tied to the client pain point, not a vague engagement prompt.');
  if (!actions.length) actions.push('Run the existing cadence, then double down on the top two hooks after the next refresh.');
  return actions.slice(0, 6);
}

function publicPostRow(post) {
  return {
    id: post.id,
    target: post.target,
    channel: post.channel,
    status: post.status,
    dueAt: post.dueAt || '',
    createdAt: post.createdAt || '',
    reactions: post.kpi.reactions,
    comments: post.kpi.comments,
    shares: post.kpi.shares,
    clicks: post.kpi.clicks,
    impressions: post.kpi.impressions,
    views: post.kpi.views,
    score: post.kpi.score,
    textPreview: post.textPreview,
  };
}

const refreshedAt = new Date().toISOString();
const warnings = [];
const organizationId = await organisationId();
const [scheduledRaw, sentRaw] = await Promise.all([
  fetchPosts(organizationId, 'scheduled'),
  fetchPosts(organizationId, 'sent'),
]);
if (scheduledRaw.truncated) warnings.push('Buffer returned more than 100 scheduled posts. Snapshot is capped at 100.');
if (sentRaw.truncated) warnings.push('Buffer returned more than 100 sent posts. Snapshot is capped at 100.');

const scheduled = scheduledRaw.posts.map(normalisePost).sort((a, b) => String(a.dueAt || '').localeCompare(String(b.dueAt || '')));
const sent = sentRaw.posts.map(normalisePost).sort((a, b) => String(b.dueAt || b.createdAt || '').localeCompare(String(a.dueAt || a.createdAt || '')));
const sent7d = sent.filter((post) => withinDays(post.dueAt || post.createdAt, 7));
const sent30d = sent.filter((post) => withinDays(post.dueAt || post.createdAt, 30));
const topPosts = [...sent].filter((post) => post.kpi.score > 0).sort((a, b) => b.kpi.score - a.kpi.score).slice(0, 5);
const weakPosts = [...sent30d].sort((a, b) => a.kpi.score - b.kpi.score).slice(0, 5);
const kpis = {
  scheduledTotal: scheduled.length,
  sentSample: sent.length,
  sent7d: sent7d.length,
  sent30d: sent30d.length,
  totals7d: totals(sent7d),
  totals30d: totals(sent30d),
  generatedAt: refreshedAt,
};

const snapshot = {
  schemaVersion: '222-linkedin-buffer-analytics-v1',
  refreshedAt,
  source: 'Buffer API via GitHub Actions',
  publicSafety: 'Contains sanitised post previews and aggregate/post-level metrics only. No tokens or secrets are stored.',
  organizationId,
  channels: channels.map(({ target, label, id }) => ({ target, label, id })),
  kpis,
  scheduled: scheduled.map(publicPostRow),
  sent: sent.map(publicPostRow),
  topPosts: topPosts.map(publicPostRow),
  weakPosts: weakPosts.map(publicPostRow),
  nextActions: buildActions({ scheduled, sent, topPosts, weakPosts, warnings }),
  warnings,
};

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'analytics-summary.json'), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
await writeFile(path.join(outDir, 'posts-scheduled.csv'), `${toCsv(snapshot.scheduled, ['id', 'target', 'channel', 'status', 'dueAt', 'createdAt', 'textPreview'])}\n`, 'utf8');
await writeFile(path.join(outDir, 'posts-sent.csv'), `${toCsv(snapshot.sent, ['id', 'target', 'channel', 'status', 'dueAt', 'createdAt', 'reactions', 'comments', 'shares', 'clicks', 'impressions', 'views', 'score', 'textPreview'])}\n`, 'utf8');
await writeFile(path.join(outDir, 'README.md'), `# LinkedIn Buffer analytics snapshot\n\nGenerated at ${refreshedAt}.\n\nThis branch is data only. It is intentionally separate from \`main\` so daily analytics refreshes do not trigger production Netlify deploys.\n`, 'utf8');

console.log(JSON.stringify({ ok: true, refreshedAt, scheduled: scheduled.length, sent: sent.length, warnings }, null, 2));
