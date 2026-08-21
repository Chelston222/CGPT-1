'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const {
  MAX_DOCUMENT_PAGES,
  MAX_IMAGE_BYTES,
  preflightOne,
  validateDeclaredMetadata,
} = require('../scripts/linkedin-media-preflight.cjs');

function responseFor(body, type = 'image/png', status = 200) {
  return new Response(body, {
    status,
    headers: {
      'content-type': type,
      'content-length': String(Buffer.byteLength(body)),
    },
  });
}

test('accepts an HTTPS image only when type, size and optional hash match', async () => {
  const bytes = Buffer.from('not-a-real-png-but-a-deterministic-test-body');
  const sha = createHash('sha256').update(bytes).digest('hex');
  const result = await preflightOne({
    url: 'https://example.com/a.png',
    fieldName: 'MEDIA_URL',
    kind: 'image',
    expectedBytes: bytes.length,
    expectedSha256: sha,
  }, async () => responseFor(bytes));
  assert.equal(result.bytes, bytes.length);
  assert.equal(result.sha256, sha);
  assert.equal(result.contentType, 'image/png');
});

test('fails closed when the approved media hash changes', async () => {
  const bytes = Buffer.from('changed');
  await assert.rejects(
    preflightOne({
      url: 'https://example.com/a.png',
      fieldName: 'MEDIA_URL',
      kind: 'image',
      expectedSha256: 'a'.repeat(64),
    }, async () => responseFor(bytes)),
    /SHA-256 changed/,
  );
});

test('rejects HTML error pages masquerading as media', async () => {
  await assert.rejects(
    preflightOne({ url: 'https://example.com/a.png', fieldName: 'MEDIA_URL', kind: 'image' }, async () => responseFor('<html>oops</html>', 'text/html')),
    /unsupported content type/,
  );
});

test('rejects oversized declared media before network access', () => {
  assert.throws(
    () => validateDeclaredMetadata({ url: 'https://example.com/a.png', kind: 'image', expectedBytes: MAX_IMAGE_BYTES + 1 }),
    /exceeds/,
  );
});

test('requires and caps document page count', () => {
  assert.throws(
    () => validateDeclaredMetadata({ url: 'https://example.com/a.pdf', kind: 'document' }),
    /DOCUMENT_PAGE_COUNT/,
  );
  assert.throws(
    () => validateDeclaredMetadata({ url: 'https://example.com/a.pdf', kind: 'document', pageCount: MAX_DOCUMENT_PAGES + 1 }),
    /exceeds 300 pages/,
  );
});

test('rejects non-HTTPS media', async () => {
  await assert.rejects(
    preflightOne({ url: 'http://example.com/a.png', fieldName: 'MEDIA_URL', kind: 'image' }, async () => responseFor('x')),
    /must use HTTPS/,
  );
});
