'use strict';

const { createHash } = require('node:crypto');

// Buffer/LinkedIn publish limits are expressed in decimal megabytes.
// Use the stricter decimal byte values so an edge-case asset cannot pass here
// and then be rejected by Buffer for being slightly over 10/100 MB.
const MAX_IMAGE_BYTES = 10_000_000;
const MAX_DOCUMENT_BYTES = 100_000_000;
const MAX_DOCUMENT_PAGES = 300;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
]);

function cleanContentType(value = '') {
  return String(value).split(';')[0].trim().toLowerCase();
}

function validateHttps(value, fieldName) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${fieldName} is not a valid URL.`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`${fieldName} must use HTTPS.`);
  return parsed;
}

function expectedLimit(kind) {
  return kind === 'document' ? MAX_DOCUMENT_BYTES : MAX_IMAGE_BYTES;
}

function validateDeclaredMetadata(media) {
  if (!media?.url) return;
  if (!['image', 'document'].includes(media.kind)) throw new Error('Media kind must be image or document.');
  if (media.kind === 'document') {
    if (!Number.isInteger(media.pageCount) || media.pageCount < 1) throw new Error('DOCUMENT_PAGE_COUNT is required for document media.');
    if (media.pageCount > MAX_DOCUMENT_PAGES) throw new Error(`Document exceeds ${MAX_DOCUMENT_PAGES} pages.`);
  }
  if (media.expectedBytes != null) {
    if (!Number.isInteger(media.expectedBytes) || media.expectedBytes < 1) throw new Error('MEDIA_BYTES must be a positive integer.');
    if (media.expectedBytes > expectedLimit(media.kind)) throw new Error(`Declared media size exceeds the ${expectedLimit(media.kind)} byte limit.`);
  }
  if (media.expectedSha256 && !/^[a-f0-9]{64}$/i.test(media.expectedSha256)) throw new Error('MEDIA_SHA256 must be a 64-character hex SHA-256 digest.');
}

async function fetchWithTimeout(url, options, fetchImpl, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal, redirect: 'follow' });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`Media request timed out after ${timeoutMs}ms.`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function readAndHash(response, limit) {
  if (!response.body) throw new Error('Media response has no body.');
  const reader = response.body.getReader();
  const hash = createHash('sha256');
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > limit) {
      try { await reader.cancel(); } catch {}
      throw new Error(`Media exceeds the ${limit} byte limit.`);
    }
    hash.update(Buffer.from(value));
  }
  return { bytes, sha256: hash.digest('hex') };
}

function validateContentType(kind, contentType) {
  if (kind === 'document') {
    if (contentType !== 'application/pdf') throw new Error(`Document media returned ${contentType || 'no content type'} instead of application/pdf.`);
    return;
  }
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) throw new Error(`Image media returned unsupported content type ${contentType || '(missing)'}.`);
}

async function preflightOne(media, fetchImpl = globalThis.fetch) {
  validateDeclaredMetadata(media);
  const original = validateHttps(media.url, media.fieldName || 'MEDIA_URL');
  const response = await fetchWithTimeout(original.toString(), { method: 'GET' }, fetchImpl);
  if (!response.ok) throw new Error(`${media.fieldName || 'MEDIA_URL'} returned HTTP ${response.status}.`);

  const finalUrl = validateHttps(response.url || original.toString(), `${media.fieldName || 'MEDIA_URL'} final URL`);
  const contentType = cleanContentType(response.headers.get('content-type'));
  validateContentType(media.kind, contentType);

  const limit = expectedLimit(media.kind);
  const headerLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(headerLength) && headerLength > limit) throw new Error(`Media Content-Length exceeds the ${limit} byte limit.`);

  const measured = await readAndHash(response, limit);
  if (media.expectedBytes != null && measured.bytes !== media.expectedBytes) {
    throw new Error(`Media byte count changed after approval: expected ${media.expectedBytes}, received ${measured.bytes}.`);
  }
  if (media.expectedSha256 && measured.sha256.toLowerCase() !== media.expectedSha256.toLowerCase()) {
    throw new Error('Media SHA-256 changed after approval.');
  }

  return {
    url: finalUrl.toString(),
    contentType,
    bytes: measured.bytes,
    sha256: measured.sha256,
  };
}

async function preflightMedia(request, fetchImpl = globalThis.fetch) {
  if (!request?.mediaUrl) return null;
  const media = await preflightOne({
    url: request.mediaUrl,
    fieldName: 'MEDIA_URL',
    kind: request.mediaKind,
    pageCount: request.documentPageCount,
    expectedBytes: request.mediaBytes,
    expectedSha256: request.mediaSha256,
  }, fetchImpl);

  let thumbnail = null;
  if (request.mediaKind === 'document') {
    thumbnail = await preflightOne({
      url: request.documentThumbnailUrl,
      fieldName: 'DOCUMENT_THUMBNAIL_URL',
      kind: 'image',
    }, fetchImpl);
  }

  return { media, thumbnail };
}

module.exports = {
  ALLOWED_IMAGE_TYPES,
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENT_PAGES,
  MAX_IMAGE_BYTES,
  cleanContentType,
  preflightMedia,
  preflightOne,
  validateDeclaredMetadata,
};
