'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const {
  MAX_DOCUMENT_PAGES,
  MAX_IMAGE_BYTES,
  MEDIA_BRIDGE_BASE,
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


test('privately bridges repository media before provider preflight', async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'li-private-media-'));
  const relative = 'apps/linkedin-review/media/test/private.jpg';
  const absolute = path.join(workspace, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);
  fs.writeFileSync(absolute, bytes);
  const sha = createHash('sha256').update(bytes).digest('hex');
  const request = {
    mediaUrl: 'https://raw.githubusercontent.com/Chelston222/CGPT-1/main/apps/linkedin-review/media/test/private.jpg',
    mediaKind: 'image',
    mediaBytes: bytes.length,
    mediaSha256: sha,
  };
  let firstLookup = true;
  let puts = 0;
  let posts = 0;
  const fetchImpl = async (url, options = {}) => {
    const value = String(url);
    const method = options.method || 'GET';
    if (value.startsWith(MEDIA_BRIDGE_BASE) && method === 'GET') {
      if (firstLookup) {
        firstLookup = false;
        return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'content-type': 'application/json' } });
      }
      const response = responseFor(bytes, 'image/jpeg', 200, value);
      response.headers.set('x-file-sha256', sha);
      return response;
    }
    if (value.startsWith(MEDIA_BRIDGE_BASE) && method === 'PUT') {
      puts += 1;
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (value.startsWith(MEDIA_BRIDGE_BASE) && method === 'POST') {
      posts += 1;
      return new Response(JSON.stringify({ ok: true, sha256: sha }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`unexpected fetch ${method} ${value}`);
  };

  const proof = await preflightMedia(request, fetchImpl, {
    workspace,
    uploadToken: 'x'.repeat(32),
    requirePrivateBridge: true,
  });
  assert.equal(request.mediaUrl.startsWith(MEDIA_BRIDGE_BASE), true);
  assert.equal(proof.media.sha256, sha);
  assert.equal(puts, 1);
  assert.equal(posts, 1);
});

test('governed private-media dispatch fails closed without bridge credential', async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'li-private-media-missing-token-'));
  const relative = 'apps/linkedin-review/media/test/private.jpg';
  const absolute = path.join(workspace, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  const request = {
    mediaUrl: 'https://raw.githubusercontent.com/Chelston222/CGPT-1/main/apps/linkedin-review/media/test/private.jpg',
    mediaKind: 'image',
  };
  await assert.rejects(
    preflightMedia(request, async () => { throw new Error('network should not be reached'); }, {
      workspace,
      uploadToken: '',
      requirePrivateBridge: true,
    }),
    /TTE_BRIDGE_TOKEN/,
  );
});


test('provider boundary rejects private ops media before network access', async () => {
  const request = {
    mediaUrl: 'https://raw.githubusercontent.com/Chelston222/CGPT-1/main/apps/linkedin-review/media/private.jpg',
    mediaKind: 'image',
  };
  await assert.rejects(
    preflightMedia(request, async () => { throw new Error('network should not be reached'); }, { forbidPrivateOpsMedia: true }),
    /provider-safe media surface/,
  );
});
