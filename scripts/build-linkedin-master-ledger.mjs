#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const archivePath = resolve(arg('--archive', '../work/consolidated-linkedin-library.json'));
const queuePath = resolve(arg('--queue', 'apps/linkedin-review/queue.json'));
const bufferAuditPath = resolve(arg('--buffer-audit', '../work/buffer-test-drafts-archive.json'));
const outputPath = resolve(arg('--output', '../work/master-linkedin-ledger.json'));
const manifestPath = resolve(arg('--manifest', 'apps/linkedin-review/ledger-manifest.json'));

const archive = JSON.parse(await readFile(archivePath, 'utf8'));
const queue = JSON.parse(await readFile(queuePath, 'utf8'));
const bufferAudit = await readFile(bufferAuditPath, 'utf8').then(JSON.parse).catch(() => ({ records: [] }));
const existing = await readFile(outputPath, 'utf8').then(JSON.parse).catch(() => null);
const normalise = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const hash = (value) => createHash('sha256').update(value).digest('hex');

const records = new Map();
for (const record of existing?.records || []) {
  if (record.source?.type === 'master_intake') records.set(record.contentHash, record);
}
for (const record of archive.records || []) {
  records.set(record.contentHash, {
    id: record.id,
    recordType: 'archive_candidate',
    title: record.title,
    content: record.content,
    contentHash: record.contentHash,
    source: { type: 'local_archive', path: record.sourcePath, duplicatePaths: record.duplicateSources || [] },
    qa: { status: 'unreviewed_import', publishable: false },
    state: 'archive',
  });
}

for (const post of queue.posts || []) {
  const primaryCopy = post.copy?.default || post.copy?.[post.targets?.[0]] || '';
  const contentHash = hash(normalise(primaryCopy));
  records.set(contentHash, {
    ...post,
    recordType: 'operational_post',
    contentHash,
    source: { type: post.sourceType || 'repo_queue', url: post.sourceUrl || null },
    qa: {
      status: post.status === 'review' ? 'ready_for_human_review' : post.status,
      publishable: post.format !== 'carousel' || (post.carousel?.readiness === 'ready' && Boolean(post.mediaUrl) && Boolean(post.documentThumbnailUrl)),
    },
  });
}

for (const artifact of bufferAudit.records || []) {
  const contentHash = hash(normalise(`${artifact.channelId} ${artifact.content}`));
  records.set(contentHash, {
    ...artifact,
    recordType: 'system_test_artifact',
    contentHash,
    source: {
      type: 'buffer_test_draft',
      channelId: artifact.channelId,
      channelName: artifact.channelName,
      capturedAt: bufferAudit.capturedAt,
    },
    qa: {
      status: 'archived_test_only',
      publishable: false,
      approvalEligible: false,
    },
  });
}

const ledger = {
  schemaVersion: 1,
  ledgerId: '222-emails-master-linkedin-ledger',
  generatedAt: new Date().toISOString(),
  privacy: 'Private operational ledger. Do not deploy: local source paths and unreleased copy are retained for provenance.',
  sources: {
    localArchive: archivePath,
    notionCalendar: 'https://app.notion.com/p/f9d99351b1ad4849af326b374d6e6b44',
    notionCommandCentre: 'https://app.notion.com/p/3abe72eb858781ac9028fde849ebb505',
    reviewProjection: queuePath,
    bufferTestArchive: bufferAuditPath,
  },
  policy: {
    operationalSourceOfTruth: 'this ledger',
    notionRole: 'editorial archive, strategy and private reference',
    publicReviewRole: 'generated live-ready projection only',
    maxAccountPlacementsPerDay: 10,
    explicitOwnerApprovalRequired: true,
  },
  summary: {
    discoveredChunks: archive.summary?.rawContentChunks || archive.records?.length || 0,
    exactDuplicatesRemoved: archive.summary?.exactDuplicatesRemoved || 0,
    uniqueMasterRecords: records.size,
    operationalPosts: queue.posts?.length || 0,
    archiveCandidates: [...records.values()].filter((record) => record.recordType === 'archive_candidate').length,
    masterIntake: [...records.values()].filter((record) => record.source?.type === 'master_intake').length,
    bufferTestArtifacts: [...records.values()].filter((record) => record.recordType === 'system_test_artifact').length,
  },
  records: [...records.values()],
};

const ledgerHash = hash(JSON.stringify(ledger.records));
const manifest = {
  schemaVersion: 1,
  ledgerId: ledger.ledgerId,
  ledgerHash,
  generatedAt: ledger.generatedAt,
  summary: ledger.summary,
  publicProjection: { file: 'queue.json', posts: queue.posts.length },
  sources: {
    notionCalendarRecords: 101,
    localFilesScanned: archive.summary?.filesScanned || 0,
    localContentChunks: archive.summary?.rawContentChunks || 0,
  },
  rules: {
    newContentEntersMasterFirst: true,
    historicalApprovalIsNotPublishPermission: true,
    maximumAccountPlacementsPerDay: 10,
    bufferFreeScheduledPerChannel: 10,
    bufferFreeConnectedChannels: 3,
  },
};

await mkdir(dirname(outputPath), { recursive: true });
await mkdir(dirname(manifestPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(ledger, null, 2)}\n`);
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, manifestPath, ledgerHash, ...ledger.summary }, null, 2));
