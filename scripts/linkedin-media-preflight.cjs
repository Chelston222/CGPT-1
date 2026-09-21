'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash, createHmac } = require('node:crypto');

// Buffer/LinkedIn publish limits are expressed in decimal megabytes.
const MAX_IMAGE_BYTES = 10_000_000;
const MAX_DOCUMENT_BYTES = 100_000_000;
const MAX_DOCUMENT_PAGES = 300;
const LEGACY_REVIEW_HOST = '222emails-review-desk.netlify.app';
const REPO_MEDIA_BASE = 'https://raw.githubusercontent.com/Chelston222/CGPT-1/main/apps/linkedin-review';
const MEDIA_BRIDGE_BASE = 'https://222emails-mail-bridge.netlify.app/api/tte/linkedin-media-bridge';
const PRIVATE_REPO_OWNER = 'Chelston222';
const PRIVATE_REPO_NAME = 'CGPT-1';
const BRIDGE_CHUNK_BYTES = 3_500_000;

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

function canonicalMediaUrl(value, fieldName = 'MEDIA_URL') {
  const parsed = validateHttps(value, fieldName);
  if (parsed.hostname.toLowerCase() !== LEGACY_REVIEW_HOST) return parsed.toString();
  if (!parsed.pathname.startsWith('/media/')) throw new Error(`${fieldName} uses the retired review host outside the governed media path.`);
  if (parsed.search || parsed.hash) throw new Error(`${fieldName} uses the retired review host with an unsupported query or fragment.`);
  return `${REPO_MEDIA_BASE}${parsed.pathname}`;
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
  const prefixParts = [];
  let prefixBytes = 0;
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > limit) {
      try { await reader.cancel(); } catch {}
      throw new Error(`Media exceeds the ${limit} byte limit.`);
    }
    if (prefixBytes < 8) {
      const remaining = 8 - prefixBytes;
      const slice = value.subarray(0, Math.min(value.byteLength, remaining));
      prefixParts.push(Buffer.from(slice));
      prefixBytes += slice.byteLength;
    }
    hash.update(Buffer.from(value));
  }
  return { bytes, sha256: hash.digest('hex'), prefix: Buffer.concat(prefixParts) };
}

function validateContentType(kind, contentType, finalUrl) {
  if (kind === 'document') {
    if (contentType === 'application/pdf') return;
    const rawGitHubPdf = contentType === 'application/octet-stream'
      && finalUrl.hostname.toLowerCase() === 'raw.githubusercontent.com'
      && /\.pdf$/i.test(finalUrl.pathname);
    if (!rawGitHubPdf) throw new Error(`Document media returned ${contentType || 'no content type'} instead of application/pdf.`);
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
  validateContentType(media.kind, contentType, finalUrl);

  const limit = expectedLimit(media.kind);
  const headerLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(headerLength) && headerLength > limit) throw new Error(`Media Content-Length exceeds the ${limit} byte limit.`);

  const measured = await readAndHash(response, limit);
  if (media.kind === 'document' && measured.prefix.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('Document media did not contain a PDF signature.');
  }
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

function repoRelativePathFromMediaUrl(value) {
  const parsed = validateHttps(value, 'MEDIA_URL');
  const host = parsed.hostname.toLowerCase();

  if (host === LEGACY_REVIEW_HOST) {
    if (!parsed.pathname.startsWith('/media/')) return null;
    if (parsed.search || parsed.hash) return null;
    return `apps/linkedin-review${parsed.pathname}`;
  }

  if (host !== 'raw.githubusercontent.com') return null;
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length < 4) return null;
  if (segments[0] !== PRIVATE_REPO_OWNER || segments[1] !== PRIVATE_REPO_NAME) return null;
  const relative = segments.slice(3).join('/');
  if (!relative.startsWith('apps/linkedin-review/media/') && !relative.startsWith('assets/linkedin-generated/')) return null;
  return relative;
}

function mediaContentTypeFromPath(filePath, kind) {
  if (kind === 'document' || /\.pdf$/i.test(filePath)) return 'application/pdf';
  if (/\.(?:jpg|jpeg)$/i.test(filePath)) return 'image/jpeg';
  if (/\.png$/i.test(filePath)) return 'image/png';
  if (/\.webp$/i.test(filePath)) return 'image/webp';
  if (/\.gif$/i.test(filePath)) return 'image/gif';
  if (/\.heic$/i.test(filePath)) return 'image/heic';
  if (/\.heif$/i.test(filePath)) return 'image/heif';
  throw new Error(`Unsupported local media extension for private hosting: ${path.basename(filePath)}.`);
}

function bridgeIdentity(bytes, token) {
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const id = `li-${sha256.slice(0, 40)}`;
  const capability = createHmac('sha256', token).update(`linkedin-media:${sha256}`).digest('base64url');
  const url = `${MEDIA_BRIDGE_BASE}?id=${encodeURIComponent(id)}&cap=${encodeURIComponent(capability)}`;
  return { sha256, id, capability, url };
}

async function responseJson(response) {
  try { return await response.json(); } catch { return {}; }
}

async function ensurePrivateHostedMedia({
  originalUrl,
  kind,
  expectedBytes = null,
  expectedSha256 = null,
  fetchImpl = globalThis.fetch,
  workspace = process.env.GITHUB_WORKSPACE || process.cwd(),
  uploadToken = process.env.TTE_BRIDGE_TOKEN || '',
}) {
  const relative = repoRelativePathFromMediaUrl(originalUrl);
  if (!relative) return null;

  const absolute = path.resolve(workspace, relative);
  const root = path.resolve(workspace) + path.sep;
  if (!absolute.startsWith(root) || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    return null;
  }
  if (!uploadToken || uploadToken.length < 24) return null;

  const bytes = fs.readFileSync(absolute);
  const limit = expectedLimit(kind);
  if (!bytes.length || bytes.length > limit) throw new Error(`Local media exceeds the ${limit} byte limit.`);

  const identity = bridgeIdentity(bytes, uploadToken);
  if (expectedBytes != null && bytes.length !== expectedBytes) {
    throw new Error(`Local media byte count changed after approval: expected ${expectedBytes}, received ${bytes.length}.`);
  }
  if (expectedSha256 && identity.sha256.toLowerCase() !== String(expectedSha256).toLowerCase()) {
    throw new Error('Local media SHA-256 changed after approval.');
  }

  const existing = await fetchWithTimeout(identity.url, { method: 'GET' }, fetchImpl);
  if (existing.ok) {
    const remoteSha = String(existing.headers.get('x-file-sha256') || '').toLowerCase();
    if (remoteSha && remoteSha !== identity.sha256) throw new Error('Private media bridge returned a conflicting SHA-256.');
    return identity.url;
  }
  if (existing.status !== 404) throw new Error(`Private media bridge lookup returned HTTP ${existing.status}.`);

  const parts = Math.ceil(bytes.length / BRIDGE_CHUNK_BYTES);
  for (let part = 1; part <= parts; part += 1) {
    const start = (part - 1) * BRIDGE_CHUNK_BYTES;
    const chunk = bytes.subarray(start, Math.min(bytes.length, start + BRIDGE_CHUNK_BYTES));
    const uploadUrl = `${MEDIA_BRIDGE_BASE}?id=${encodeURIComponent(identity.id)}&part=${part}`;
    const response = await fetchWithTimeout(uploadUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${uploadToken}` },
      body: chunk,
    }, fetchImpl, 30_000);
    if (!response.ok) {
      const payload = await responseJson(response);
      throw new Error(`Private media bridge chunk upload failed: HTTP ${response.status} ${JSON.stringify(payload)}`);
    }
  }

  const type = mediaContentTypeFromPath(absolute, kind);
  const finalise = await fetchWithTimeout(`${MEDIA_BRIDGE_BASE}?id=${encodeURIComponent(identity.id)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${uploadToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parts,
      expectedBytes: bytes.length,
      expectedSha256: identity.sha256,
      capability: identity.capability,
      contentType: type,
      filename: path.basename(absolute).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120),
    }),
  }, fetchImpl, 45_000);
  if (!finalise.ok) {
    const payload = await responseJson(finalise);
    throw new Error(`Private media bridge finalise failed: HTTP ${finalise.status} ${JSON.stringify(payload)}`);
  }

  const verify = await fetchWithTimeout(identity.url, { method: 'GET' }, fetchImpl, 30_000);
  if (!verify.ok) throw new Error(`Private media bridge verification returned HTTP ${verify.status}.`);
  const remoteSha = String(verify.headers.get('x-file-sha256') || '').toLowerCase();
  if (remoteSha !== identity.sha256) throw new Error('Private media bridge verification SHA-256 mismatch.');

  return identity.url;
}

async function preflightMedia(request, fetchImpl = globalThis.fetch, options = {}) {
  if (!request?.mediaUrl) return null;

  const privatelyHosted = await ensurePrivateHostedMedia({
    originalUrl: request.mediaUrl,
    kind: request.mediaKind,
    expectedBytes: request.mediaBytes,
    expectedSha256: request.mediaSha256,
    fetchImpl,
    workspace: options.workspace,
    uploadToken: options.uploadToken,
  });
  request.mediaUrl = privatelyHosted || canonicalMediaUrl(request.mediaUrl, 'MEDIA_URL');

  if (request.documentThumbnailUrl) {
    const privateThumb = await ensurePrivateHostedMedia({
      originalUrl: request.documentThumbnailUrl,
      kind: 'image',
      fetchImpl,
      workspace: options.workspace,
      uploadToken: options.uploadToken,
    });
    request.documentThumbnailUrl = privateThumb || canonicalMediaUrl(request.documentThumbnailUrl, 'DOCUMENT_THUMBNAIL_URL');
  }

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
  BRIDGE_CHUNK_BYTES,
  LEGACY_REVIEW_HOST,
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENT_PAGES,
  MAX_IMAGE_BYTES,
  MEDIA_BRIDGE_BASE,
  REPO_MEDIA_BASE,
  bridgeIdentity,
  canonicalMediaUrl,
  cleanContentType,
  ensurePrivateHostedMedia,
  mediaContentTypeFromPath,
  preflightMedia,
  preflightOne,
  repoRelativePathFromMediaUrl,
  validateDeclaredMetadata,
};
