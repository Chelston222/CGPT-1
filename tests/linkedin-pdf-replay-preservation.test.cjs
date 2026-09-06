'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { restoreGovernedMediaOnReplay, snapshotFile } = require('../scripts/linkedin-pdf-intake.cjs');

function digest(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

test('idempotent replay restores the already governed PDF and thumbnail bytes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'linkedin-pdf-replay-'));
  const pdfPath = path.join(dir, 'post.pdf');
  const jpgPath = path.join(dir, 'thumbnail.jpg');
  const governedPdf = Buffer.from('%PDF-1.4\nlocked-governed-pdf\n');
  const governedJpg = Buffer.from('locked-governed-thumbnail');
  fs.writeFileSync(pdfPath, governedPdf);
  fs.writeFileSync(jpgPath, governedJpg);

  const existingPdf = snapshotFile(pdfPath);
  const existingJpg = snapshotFile(jpgPath);

  fs.writeFileSync(pdfPath, Buffer.from('%PDF-1.4\nregenerated-but-equivalent-placeholder\n'));
  fs.writeFileSync(jpgPath, Buffer.from('renderer-version-drift-thumbnail'));

  const restored = restoreGovernedMediaOnReplay({
    queueResult: { changed: false, replay: true },
    pdfPath,
    jpgPath,
    existingPdf,
    existingJpg,
    metadata: { bytes: governedPdf.length, sha256: digest(governedPdf) },
  });

  assert.equal(restored, true);
  assert.deepEqual(fs.readFileSync(pdfPath), governedPdf);
  assert.deepEqual(fs.readFileSync(jpgPath), governedJpg);
});

test('replay fails closed if the previously governed media is missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'linkedin-pdf-replay-missing-'));
  const pdfPath = path.join(dir, 'post.pdf');
  const jpgPath = path.join(dir, 'thumbnail.jpg');
  const incoming = Buffer.from('%PDF-1.4\nincoming\n');
  fs.writeFileSync(pdfPath, incoming);
  fs.writeFileSync(jpgPath, Buffer.from('new-thumbnail'));

  assert.throws(() => restoreGovernedMediaOnReplay({
    queueResult: { changed: false, replay: true },
    pdfPath,
    jpgPath,
    existingPdf: null,
    existingJpg: null,
    metadata: { bytes: incoming.length, sha256: digest(incoming) },
  }), /previously governed PDF bytes/);
});

test('replay fails closed if existing governed PDF bytes drift from the locked incoming identity', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'linkedin-pdf-replay-drift-'));
  const pdfPath = path.join(dir, 'post.pdf');
  const jpgPath = path.join(dir, 'thumbnail.jpg');
  const governedPdf = Buffer.from('%PDF-1.4\nold-drifted\n');
  const incomingPdf = Buffer.from('%PDF-1.4\nlocked-incoming\n');
  fs.writeFileSync(pdfPath, incomingPdf);
  fs.writeFileSync(jpgPath, Buffer.from('new-thumbnail'));

  assert.throws(() => restoreGovernedMediaOnReplay({
    queueResult: { changed: false, replay: true },
    pdfPath,
    jpgPath,
    existingPdf: governedPdf,
    existingJpg: Buffer.from('governed-thumbnail'),
    metadata: { bytes: incomingPdf.length, sha256: digest(incomingPdf) },
  }), /byte count drifted|SHA-256 drifted/);
});

test('non-replay intake leaves newly generated media untouched', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'linkedin-pdf-new-'));
  const pdfPath = path.join(dir, 'post.pdf');
  const jpgPath = path.join(dir, 'thumbnail.jpg');
  const freshPdf = Buffer.from('%PDF-1.4\nfresh\n');
  const freshJpg = Buffer.from('fresh-thumbnail');
  fs.writeFileSync(pdfPath, freshPdf);
  fs.writeFileSync(jpgPath, freshJpg);

  const restored = restoreGovernedMediaOnReplay({
    queueResult: { changed: true, replay: false },
    pdfPath,
    jpgPath,
    existingPdf: null,
    existingJpg: null,
    metadata: { bytes: freshPdf.length, sha256: digest(freshPdf) },
  });

  assert.equal(restored, false);
  assert.deepEqual(fs.readFileSync(pdfPath), freshPdf);
  assert.deepEqual(fs.readFileSync(jpgPath), freshJpg);
});