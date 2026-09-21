'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const {
  MAX_DOCUMENT_PAGES,
  MAX_IMAGE_BYTES,
  REPO_MEDIA_BASE,
  canonicalMediaUrl,
  preflightMedia,
  preflightOne,
  validateDeclaredMetadata,
} = require('../scripts/linkedin-media-preflight.cjs');

function responseFor(body, type = 'image/png', status = 200, url = 'https://example.com/a.png') {
  const response = new Response(body, {
    status,
    headers: {
      'content-type': type,
      'content-length': String(Buffer.byteLength(body)),
    },
  });
  Object.defineProperty(response, 'url', { value: url });
  return response;
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

test('accepts raw GitHub PDF octet-stream only when URL and PDF signature are valid', async () => {
  const bytes = Buffer.from('%PDF-1.7\nminimal test body');
  const sha = createHash('sha256').update(bytes).digest('hex');
  const url = 'https://raw.githubusercontent.com/Chelston222/CGPT-1/main/a.pdf';
  const result = await preflightOne({
    url,
    fieldName: 'MEDIA_URL',
    kind: 'document',
    pageCount: 1,
    expectedBytes: bytes.length,
    expectedSha256: sha,
  }, async () => responseFor(bytes, 'application/octet-stream', 200, url));
  assert.equal(result.sha256, sha);
  assert.equal(result.contentType, 'application/octet-stream');
});

test('canonicalises only governed legacy review-desk media paths', () => {
  assert.equal(
    canonicalMediaUrl('https://222emails-review-desk.netlify.app/media/carousels/028/222-emails-carousel-028.pdf'),
    `${REPO_MEDIA_BASE}/media/carousels/028/222-emails-carousel-028.pdf`,
  );
  assert.equal(
    canonicalMediaUrl('https://example.com/media/a.pdf'),
    'https://example.com/media/a.pdf',
  );
  assert.throws(
    () => canonicalMediaUrl('https://222emails-review-desk.netlify.app/queue.json'),
    /outside the governed media path/,
  );
});

test('preflight mutates legacy transport to the exact canonical URL that passed integrity checks', async () => {
  const pdf = Buffer.from('%PDF-1.7\nlocked test body');
  const thumb = Buffer.from('thumbnail');
  const sha = createHash('sha256').update(pdf).digest('hex');
  const request = {
    mediaUrl: 'https://222emails-review-desk.netlify.app/media/carousels/028/222-emails-carousel-028.pdf',
    mediaKind: 'document',
    documentThumbnailUrl: 'https://222emails-review-desk.netlify.app/media/carousels/028/thumbnail.jpg',
    documentPageCount: 1,
    mediaBytes: pdf.length,
    mediaSha256: sha,
  };
  const fetchImpl = async (url) => {
    if (String(url).endsWith('.pdf')) return responseFor(pdf, 'application/octet-stream', 200, String(url));
    return responseFor(thumb, 'image/jpeg', 200, String(url));
  };
  const proof = await preflightMedia(request, fetchImpl);
  assert.equal(request.mediaUrl, `${REPO_MEDIA_BASE}/media/carousels/028/222-emails-carousel-028.pdf`);
  assert.equal(request.documentThumbnailUrl, `${REPO_MEDIA_BASE}/media/carousels/028/thumbnail.jpg`);
  assert.equal(proof.media.url, request.mediaUrl);
  assert.equal(proof.media.sha256, sha);
});

test('rejects octet-stream document without a PDF signature', async () => {
  const url = 'https://raw.githubusercontent.com/Chelston222/CGPT-1/main/a.pdf';
  await assert.rejects(
    preflightOne({ url, fieldName: 'MEDIA_URL', kind: 'document', pageCount: 1 }, async () => responseFor('not pdf', 'application/octet-stream', 200, url)),
    /PDF signature/,
  );
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
