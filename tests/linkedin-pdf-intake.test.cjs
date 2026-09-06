'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  buildQueuePost,
  loadManifest,
  rawUrl,
  safeId,
  stablePostFingerprint,
  upsertQueue,
  validateDownloadUrl,
  verifyPdfFile,
} = require('../scripts/linkedin-pdf-intake.cjs');

function baseManifest(overrides = {}) {
  return {
    schemaVersion: 1,
    id: 'demo-chunks',
    revision: 1,
    title: 'Demo',
    documentTitle: 'Demo PDF',
    copy: { default: 'Caption' },
    targets: ['secondary'],
    publicMediaApproved: true,
    chunks: ['media-staging/pdf-intake/demo/part-001.b64'],
    ...overrides,
  };
}

test('safeId accepts stable queue IDs and rejects path-like input', () => {
  assert.equal(safeId('tte-li-cold-enquiries-001'), 'tte-li-cold-enquiries-001');
  assert.throws(() => safeId('../escape'), /manifest.id/);
});

test('rawUrl preserves revision-scoped repository paths', () => {
  assert.equal(
    rawUrl('Chelston222', 'CGPT-1', 'main', 'apps/linkedin-review/media/intake/demo/r2/demo.pdf'),
    'https://raw.githubusercontent.com/Chelston222/CGPT-1/main/apps/linkedin-review/media/intake/demo/r2/demo.pdf',
  );
});

test('loadManifest requires document title, copy, targets and exactly one transport', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-intake-'));
  const file = path.join(dir, 'manifest.json');
  fs.writeFileSync(file, JSON.stringify({ schemaVersion: 1, id: 'demo', revision: 1, publicMediaApproved: true, title: 'Demo' }));
  assert.throws(() => loadManifest(file), /documentTitle/);
});

test('loadManifest requires an explicit positive integer revision and public-media acknowledgement', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-intake-contract-'));
  const file = path.join(dir, 'manifest.json');
  fs.writeFileSync(file, JSON.stringify(baseManifest({ revision: undefined })));
  assert.throws(() => loadManifest(file), /revision/);
  fs.writeFileSync(file, JSON.stringify(baseManifest({ publicMediaApproved: false })));
  assert.throws(() => loadManifest(file), /publicMediaApproved/);
});

test('loadManifest accepts the legacy chunk transport after the current safety contract', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-intake-chunk-'));
  const file = path.join(dir, 'manifest.json');
  fs.writeFileSync(file, JSON.stringify(baseManifest()));
  const manifest = loadManifest(file);
  assert.deepEqual(manifest.chunks, ['media-staging/pdf-intake/demo/part-001.b64']);
  assert.equal(manifest.downloadUrl, undefined);
});

test('loadManifest accepts HTTPS download bridge only with locked SHA-256', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-intake-url-'));
  const file = path.join(dir, 'manifest.json');
  const base = baseManifest({
    id: 'demo-download',
    chunks: undefined,
    downloadUrl: 'https://files.example.com/final.pdf',
  });
  fs.writeFileSync(file, JSON.stringify(base));
  assert.throws(() => loadManifest(file), /expectedSha256 is required/);
  fs.writeFileSync(file, JSON.stringify({ ...base, expectedSha256: 'a'.repeat(64) }));
  const manifest = loadManifest(file);
  assert.equal(manifest.downloadUrl, 'https://files.example.com/final.pdf');
});

test('loadManifest rejects ambiguous transport, unsafe URLs and duplicate targets', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-intake-transport-'));
  const file = path.join(dir, 'manifest.json');
  const base = baseManifest({ expectedSha256: 'a'.repeat(64) });
  fs.writeFileSync(file, JSON.stringify({ ...base, chunks: ['x.b64'], downloadUrl: 'https://files.example.com/final.pdf' }));
  assert.throws(() => loadManifest(file), /exactly one PDF transport/);
  fs.writeFileSync(file, JSON.stringify(baseManifest({ targets: ['secondary', 'secondary'] })));
  assert.throws(() => loadManifest(file), /duplicate destinations/);
  assert.throws(() => validateDownloadUrl('http://files.example.com/a.pdf'), /HTTPS/);
  assert.throws(() => validateDownloadUrl('https://127.0.0.1/a.pdf'), /local or private/);
  assert.throws(() => validateDownloadUrl('https://10.0.0.5/a.pdf'), /local or private/);
});

test('loadManifest requires explicit timezone information in scheduled timestamps', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-intake-schedule-'));
  const file = path.join(dir, 'manifest.json');
  fs.writeFileSync(file, JSON.stringify(baseManifest({ mode: 'schedule', scheduledAt: { secondary: '2026-09-16T08:45:00' } })));
  assert.throws(() => loadManifest(file), /explicit Z or UTC offset/);
  fs.writeFileSync(file, JSON.stringify(baseManifest({ mode: 'schedule', scheduledAt: { secondary: '2026-09-16T08:45:00+01:00' } })));
  assert.equal(loadManifest(file).scheduledAt.secondary, '2026-09-16T08:45:00+01:00');
});

test('verifyPdfFile locks exact bytes and rejects mismatches', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-intake-verify-'));
  const file = path.join(dir, 'demo.pdf');
  const bytes = Buffer.from('%PDF-1.4\nminimal-test\n');
  fs.writeFileSync(file, bytes);
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  const result = verifyPdfFile(file, digest);
  assert.equal(result.bytes, bytes.length);
  assert.equal(result.sha256, digest);
  assert.throws(() => verifyPdfFile(file, 'b'.repeat(64)), /SHA-256 mismatch/);
});

test('buildQueuePost creates review-only carousel metadata without publish authority', () => {
  const post = buildQueuePost({
    id: 'tte-li-demo',
    revision: 2,
    title: 'Demo carousel',
    documentTitle: 'Demo document',
    targets: ['main'],
    mode: 'draft',
    copy: { default: 'Useful caption' },
    publicMediaApproved: true,
  }, {
    bytes: 1234,
    sha256: 'a'.repeat(64),
    pageCount: 9,
  }, {
    pdfUrl: 'https://raw.githubusercontent.com/x/y/main/a.pdf',
    thumbnailUrl: 'https://raw.githubusercontent.com/x/y/main/a.jpg',
  }, '2026-08-29T15:00:00.000Z');

  assert.equal(post.format, 'carousel');
  assert.equal(post.mode, 'draft');
  assert.equal(post.status, 'review');
  assert.equal(post.carousel.slideCount, 9);
  assert.equal(post.carousel.pdfBytes, 1234);
  assert.equal(post.carousel.publicMediaApproved, true);
  assert.equal(post.sourceType, 'chatgpt_pdf_intake');
  assert.equal(post.scheduledAt, undefined);
});

test('buildQueuePost records HTTPS bridge provenance without persisting transport URL', () => {
  const post = buildQueuePost({
    id: 'tte-li-download',
    revision: 1,
    title: 'Download carousel',
    documentTitle: 'Download document',
    targets: ['secondary'],
    mode: 'draft',
    copy: { default: 'Useful caption' },
    publicMediaApproved: true,
    downloadUrl: 'https://files.example.com/private-signed.pdf?token=secret',
  }, {
    bytes: 2222,
    sha256: 'c'.repeat(64),
    pageCount: 10,
  }, {
    pdfUrl: 'https://raw.githubusercontent.com/x/y/main/a.pdf',
    thumbnailUrl: 'https://raw.githubusercontent.com/x/y/main/a.jpg',
  }, '2026-09-04T19:00:00.000Z');
  assert.match(post.history[0].note, /HTTPS binary bridge/);
  assert.equal(JSON.stringify(post).includes('token=secret'), false);
});

test('stable post fingerprint ignores audit timestamps but locks release material', () => {
  const a = buildQueuePost({ id: 'tte-li-demo', revision: 2, title: 'Demo', documentTitle: 'Doc', targets: ['secondary'], mode: 'schedule', scheduledAt: { secondary: '2026-09-16T08:45:00+01:00' }, copy: { default: 'Caption' }, sourceUrl: 'https://app.notion.com/p/1234567890abcdef1234567890abcdef', publicMediaApproved: true }, { bytes: 1, sha256: 'a'.repeat(64), pageCount: 1 }, { pdfUrl: 'https://raw.githubusercontent.com/x/y/main/a.pdf', thumbnailUrl: 'https://raw.githubusercontent.com/x/y/main/a.jpg' }, '2026-09-01T00:00:00Z');
  const b = JSON.parse(JSON.stringify(a));
  b.carousel.verifiedAt = '2026-09-02T00:00:00Z';
  b.history[0].at = '2026-09-02T00:00:00Z';
  assert.equal(stablePostFingerprint(a), stablePostFingerprint(b));
  b.copy.default = 'Changed';
  assert.notEqual(stablePostFingerprint(a), stablePostFingerprint(b));
});

test('upsertQueue is replay-safe for an identical same revision, rejects conflicting same revision and accepts higher revision', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-queue-'));
  const queuePath = path.join(dir, 'queue.json');
  const current = {
    id: 'tte-li-demo', revision: 2, title: 'Demo', category: 'buyer_diagnostics', funnelStage: 'mof', format: 'carousel', targets: ['secondary'], mode: 'schedule', scheduledAt: { secondary: '2026-09-16T08:45:00+01:00' }, copy: { default: 'Caption' }, mediaAlt: 'Alt', mediaUrl: 'https://raw.githubusercontent.com/x/y/main/r2/demo.pdf', documentTitle: 'Doc', documentThumbnailUrl: 'https://raw.githubusercontent.com/x/y/main/r2/thumbnail.jpg', carousel: { slideCount: 10, pdfBytes: 100, pdfSha256: 'a'.repeat(64) }, sourceUrl: 'https://app.notion.com/p/1234567890abcdef1234567890abcdef', sourceType: 'chatgpt_pdf_intake',
  };
  fs.writeFileSync(queuePath, JSON.stringify({ posts: [current] }));
  const replay = upsertQueue(queuePath, JSON.parse(JSON.stringify(current)), '2026-08-29T15:00:00.000Z');
  assert.deepEqual(replay, { changed: false, replay: true });
  const conflict = JSON.parse(JSON.stringify(current));
  conflict.copy.default = 'Changed';
  assert.throws(() => upsertQueue(queuePath, conflict, '2026-08-29T15:00:00.000Z'), /conflicts with the requested same revision/);
  const higher = { ...JSON.parse(JSON.stringify(current)), revision: 3, mediaUrl: 'https://raw.githubusercontent.com/x/y/main/r3/demo.pdf', documentThumbnailUrl: 'https://raw.githubusercontent.com/x/y/main/r3/thumbnail.jpg' };
  upsertQueue(queuePath, higher, '2026-08-29T15:00:00.000Z');
  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  assert.equal(queue.posts[0].revision, 3);
});
