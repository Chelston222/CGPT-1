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
  upsertQueue,
  validateDownloadUrl,
  verifyPdfFile,
} = require('../scripts/linkedin-pdf-intake.cjs');

test('safeId accepts stable queue IDs and rejects path-like input', () => {
  assert.equal(safeId('tte-li-cold-enquiries-001'), 'tte-li-cold-enquiries-001');
  assert.throws(() => safeId('../escape'), /manifest.id/);
});

test('rawUrl creates an immutable-shaped public repository URL', () => {
  assert.equal(
    rawUrl('Chelston222', 'CGPT-1', 'main', 'apps/linkedin-review/media/intake/demo/demo.pdf'),
    'https://raw.githubusercontent.com/Chelston222/CGPT-1/main/apps/linkedin-review/media/intake/demo/demo.pdf',
  );
});

test('loadManifest requires document title, copy, targets and exactly one transport', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-intake-'));
  const file = path.join(dir, 'manifest.json');
  fs.writeFileSync(file, JSON.stringify({ schemaVersion: 1, id: 'demo', title: 'Demo' }));
  assert.throws(() => loadManifest(file), /documentTitle/);
});

test('loadManifest accepts the legacy chunk transport', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-intake-chunk-'));
  const file = path.join(dir, 'manifest.json');
  fs.writeFileSync(file, JSON.stringify({
    schemaVersion: 1,
    id: 'demo-chunks',
    title: 'Demo',
    documentTitle: 'Demo PDF',
    copy: { default: 'Caption' },
    targets: ['secondary'],
    chunks: ['media-staging/pdf-intake/demo/part-001.b64'],
  }));
  const manifest = loadManifest(file);
  assert.deepEqual(manifest.chunks, ['media-staging/pdf-intake/demo/part-001.b64']);
  assert.equal(manifest.downloadUrl, undefined);
});

test('loadManifest accepts HTTPS download bridge only with locked SHA-256', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-intake-url-'));
  const file = path.join(dir, 'manifest.json');
  const base = {
    schemaVersion: 1,
    id: 'demo-download',
    title: 'Demo',
    documentTitle: 'Demo PDF',
    copy: { default: 'Caption' },
    targets: ['secondary'],
    downloadUrl: 'https://files.example.com/final.pdf',
  };
  fs.writeFileSync(file, JSON.stringify(base));
  assert.throws(() => loadManifest(file), /expectedSha256 is required/);
  fs.writeFileSync(file, JSON.stringify({ ...base, expectedSha256: 'a'.repeat(64) }));
  const manifest = loadManifest(file);
  assert.equal(manifest.downloadUrl, 'https://files.example.com/final.pdf');
});

test('loadManifest rejects ambiguous transport and unsafe URLs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-intake-transport-'));
  const file = path.join(dir, 'manifest.json');
  const base = {
    schemaVersion: 1,
    id: 'demo-transport',
    title: 'Demo',
    documentTitle: 'Demo PDF',
    copy: { default: 'Caption' },
    targets: ['secondary'],
    expectedSha256: 'a'.repeat(64),
  };
  fs.writeFileSync(file, JSON.stringify({ ...base, chunks: ['x.b64'], downloadUrl: 'https://files.example.com/final.pdf' }));
  assert.throws(() => loadManifest(file), /exactly one PDF transport/);
  assert.throws(() => validateDownloadUrl('http://files.example.com/a.pdf'), /HTTPS/);
  assert.throws(() => validateDownloadUrl('https://127.0.0.1/a.pdf'), /local or private/);
  assert.throws(() => validateDownloadUrl('https://10.0.0.5/a.pdf'), /local or private/);
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

test('upsertQueue rejects stale revisions and accepts a higher revision', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-queue-'));
  const queuePath = path.join(dir, 'queue.json');
  fs.writeFileSync(queuePath, JSON.stringify({ posts: [{ id: 'tte-li-demo', revision: 2 }] }));
  assert.throws(() => upsertQueue(queuePath, { id: 'tte-li-demo', revision: 2 }, '2026-08-29T15:00:00.000Z'), /strictly higher revision/);
  upsertQueue(queuePath, { id: 'tte-li-demo', revision: 3 }, '2026-08-29T15:00:00.000Z');
  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  assert.equal(queue.posts[0].revision, 3);
});
