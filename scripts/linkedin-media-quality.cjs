'use strict';

const MINIMUMS = {
  portrait: { width: 1080, height: 1350 },
  square: { width: 1080, height: 1080 },
  landscape: { width: 1200, height: 627 },
};

function assertStableMediaUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  const host = parsed.hostname.toLowerCase();
  const queryKeys = [...parsed.searchParams.keys()].map((key) => key.toLowerCase());
  const isKnownPreviewHost = host === 'media.canva.com' || host === 'drive.google.com';
  const isCanvaThumbnail = parsed.searchParams.get('x-canva-quality') === 'thumbnail';
  const isExpiringSignedUrl = queryKeys.includes('x-amz-signature') || queryKeys.includes('x-goog-signature');

  if (isKnownPreviewHost || isCanvaThumbnail) {
    throw new Error('MEDIA_URL uses a preview/authenticated delivery URL. Stage the full-resolution asset to a stable direct HTTPS file before Buffer scheduling.');
  }
  if (isExpiringSignedUrl) {
    throw new Error('MEDIA_URL appears to be an expiring signed URL. Buffer media must remain directly reachable until publication.');
  }
  return parsed;
}

function pngDimensions(buffer) {
  if (buffer.length < 24 || buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), format: 'png' };
}

function jpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
    if (offset + 4 > buffer.length) break;
    const length = buffer.readUInt16BE(offset + 2);
    const sof = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf];
    if (sof.includes(marker) && offset + 9 < buffer.length) {
      return {
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5),
        format: 'jpeg',
      };
    }
    if (length < 2) break;
    offset += 2 + length;
  }
  return null;
}

function webpDimensions(buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    const width = 1 + buffer.readUIntLE(24, 3);
    const height = 1 + buffer.readUIntLE(27, 3);
    return { width, height, format: 'webp' };
  }
  return null;
}

function dimensions(buffer) {
  return pngDimensions(buffer) || jpegDimensions(buffer) || webpDimensions(buffer);
}

function requiredMinimum(width, height) {
  const ratio = width / height;
  if (ratio < 0.95) return { shape: 'portrait', ...MINIMUMS.portrait };
  if (ratio > 1.05) return { shape: 'landscape', ...MINIMUMS.landscape };
  return { shape: 'square', ...MINIMUMS.square };
}

async function assertHostedImageQuality(rawUrl, fetchFn = global.fetch) {
  if (typeof fetchFn !== 'function') throw new Error('No fetch implementation available for media QA.');
  assertStableMediaUrl(rawUrl);

  const response = await fetchFn(rawUrl, { redirect: 'follow', cache: 'no-store' });
  if (!response.ok) throw new Error(`MEDIA_URL could not be fetched for QA (HTTP ${response.status}).`);
  assertStableMediaUrl(response.url || rawUrl);

  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (contentType && !contentType.startsWith('image/')) throw new Error(`MEDIA_URL did not return an image (${contentType}).`);

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 20000) throw new Error(`MEDIA_URL image is suspiciously small (${buffer.length} bytes).`);
  const info = dimensions(buffer);
  if (!info) throw new Error('MEDIA_URL image dimensions could not be verified. Use a direct PNG, JPEG, or VP8X WebP asset.');

  const minimum = requiredMinimum(info.width, info.height);
  if (info.width < minimum.width || info.height < minimum.height) {
    throw new Error(`MEDIA_URL is too low resolution for ${minimum.shape} LinkedIn media: ${info.width}x${info.height}. Minimum is ${minimum.width}x${minimum.height}.`);
  }

  return { ...info, bytes: buffer.length, shape: minimum.shape };
}

module.exports = {
  MINIMUMS,
  assertHostedImageQuality,
  assertStableMediaUrl,
  dimensions,
  requiredMinimum,
};
