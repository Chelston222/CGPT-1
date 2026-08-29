'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { buildQueuePost, loadManifest, rawUrl, safeId, upsertQueue } = require('../scripts/linkedin-pdf-intake.cjs');

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

test('loadManifest requires document title, copy, targets and chunks', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-intake-'));
  const file = path.join(dir, 'manifest.json');
  fs.writeFileSync(file, JSON.stringify({ schemaVersion: 1, id: 'demo', title: 'Demo' }));
  assert.throws(() => loadManifest(file), /documentTitle/);
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

test('upsertQueue rejects stale revisions and accepts a higher revision', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-queue-'));
  const queuePath = path.join(dir, 'queue.json');
  fs.writeFileSync(queuePath, JSON.stringify({ posts: [{ id: 'tte-li-demo', revision: 2 }] }));
  assert.throws(() => upsertQueue(queuePath, { id: 'tte-li-demo', revision: 2 }, '2026-08-29T15:00:00.000Z'), /strictly higher revision/);
  upsertQueue(queuePath, { id: 'tte-li-demo', revision: 3 }, '2026-08-29T15:00:00.000Z');
  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  assert.equal(queue.posts[0].revision, 3);
});
