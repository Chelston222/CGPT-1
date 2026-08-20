'use strict';

const TARGET_ALIASES = {
  personal: ['personal'],
  business: ['main'],
  main: ['main'],
  secondary: ['secondary'],
  retentionlab: ['secondary'],
  lab: ['secondary'],
  both: ['personal', 'main'],
  all: ['personal', 'main', 'secondary'],
};

const TARGET_LABELS = {
  personal: 'Chelston personal',
  main: 'Main 222 Emails page',
  secondary: '222 Emails | Retention Lab',
};

const TARGET_SECRET_NAMES = {
  personal: 'BUFFER_LINKEDIN_PERSONAL_CHANNEL_ID',
  main: 'BUFFER_LINKEDIN_BUSINESS_CHANNEL_ID',
  secondary: 'BUFFER_LINKEDIN_SECONDARY_CHANNEL_ID',
};

const TRIPLE_TWO_LINKEDIN_PAGE = {
  id: '105869150',
  entity: 'urn:li:organization:105869150',
  link: 'https://www.linkedin.com/company/105869150',
  vanityName: '222emails',
  localizedName: 'Triple Two Emails',
};

function parseIssueBody(body = '') {
  const lines = String(body).split(/\r?\n/);
  const header = {};
  const separator = lines.findIndex((line) => line.trim() === '---');

  if (separator < 0) throw new Error('Missing --- separator. Use the approved post template.');

  for (let i = 0; i < separator; i += 1) {
    const match = lines[i].match(/^([A-Z][A-Z0-9_]+):\s*(.*)$/);
    if (match) header[match[1]] = match[2].trim();
  }

  const copy = { default: [] };
  let section = 'default';
  for (const line of lines.slice(separator + 1)) {
    const marker = line.trim().match(/^---(PERSONAL|MAIN|SECONDARY)---$/i);
    if (marker) {
      section = marker[1].toLowerCase();
      copy[section] = [];
    } else {
      copy[section].push(line);
    }
  }

  const normalisedCopy = Object.fromEntries(
    Object.entries(copy).map(([key, value]) => [key, value.join('\n').trim()]),
  );

  return { header, copy: normalisedCopy };
}

function normaliseTargets(rawTarget = 'personal') {
  const raw = String(rawTarget).toLowerCase().trim();
  if (TARGET_ALIASES[raw]) return [...TARGET_ALIASES[raw]];

  const targets = raw
    .split(/[,+]/)
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap((value) => TARGET_ALIASES[value] || [value]);

  const unique = [...new Set(targets)];
  if (!unique.length || unique.some((target) => !TARGET_LABELS[target])) {
    throw new Error('TARGETS must use personal, main, secondary/retentionlab, or a comma-separated combination.');
  }
  return unique;
}

function validateHttpsUrl(rawUrl, fieldName = 'MEDIA_URL') {
  if (!rawUrl) return null;
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`${fieldName} is invalid.`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`${fieldName} must use HTTPS.`);
  return parsed.toString();
}

function validateStableMediaUrl(rawUrl, fieldName = 'MEDIA_URL') {
  const validated = validateHttpsUrl(rawUrl, fieldName);
  if (!validated) return null;

  const parsed = new URL(validated);
  const host = parsed.hostname.toLowerCase();
  const queryKeys = [...parsed.searchParams.keys()].map((key) => key.toLowerCase());
  const previewOrAuthenticatedHost = host === 'media.canva.com' || host === 'drive.google.com' || host === 'docs.google.com';
  const explicitThumbnail = String(parsed.searchParams.get('x-canva-quality') || '').toLowerCase() === 'thumbnail';
  const expiringSignature = queryKeys.includes('x-amz-signature') || queryKeys.includes('x-goog-signature');

  if (previewOrAuthenticatedHost || explicitThumbnail) {
    throw new Error(`${fieldName} must be a stable direct full-resolution file URL, not a Canva preview or Google Drive/Docs share URL.`);
  }
  if (expiringSignature) {
    throw new Error(`${fieldName} appears to be an expiring signed URL. Use a stable direct file URL that remains reachable until publication.`);
  }
  return validated;
}

function resolveSchedule(header, target, mode, now = Date.now()) {
  if (mode !== 'schedule') return null;
  const field = `SCHEDULE_AT_${target.toUpperCase()}`;
  const raw = header[field] || header.SCHEDULE_AT;
  if (!raw) throw new Error(`${field} or SCHEDULE_AT is required in schedule mode.`);
  const dueAt = new Date(raw);
  if (Number.isNaN(dueAt.getTime())) throw new Error(`${field} is not a valid ISO date/time.`);
  if (dueAt.getTime() <= now + 60_000) throw new Error(`${field} must be at least one minute in the future.`);
  return dueAt.toISOString();
}

function resolveCopy(copy, target) {
  const text = String(copy[target] || copy.default || '').trim();
  if (!text) throw new Error(`Post copy is empty for ${target}.`);
  if (text.length > 3000) throw new Error(`Post copy for ${target} exceeds 3,000 characters.`);
  return text;
}

function validateRequest(body, env = {}, now = Date.now()) {
  const { header, copy } = parseIssueBody(body);
  const targets = normaliseTargets(header.TARGETS || header.TARGET || 'personal');
  const mode = (header.MODE || 'schedule').toLowerCase();
  if (!['schedule', 'queue', 'draft'].includes(mode)) {
    throw new Error('MODE must be schedule, queue, or draft.');
  }
  if (!env.BUFFER_API_KEY) throw new Error('Missing BUFFER_API_KEY repository secret.');

  const mediaUrl = validateStableMediaUrl(header.MEDIA_URL);
  const mediaKind = (header.MEDIA_KIND || (mediaUrl && /\.pdf(?:$|\?)/i.test(mediaUrl) ? 'document' : 'image')).toLowerCase();
  if (!['image', 'document'].includes(mediaKind)) throw new Error('MEDIA_KIND must be image or document.');

  const contentQa = String(header.CONTENT_QA || '').trim().toLowerCase();
  const safeZoneQa = String(header.SAFE_ZONE_QA || '').trim().toLowerCase();
  if (contentQa !== 'pass') {
    throw new Error('CONTENT_QA: PASS is required before any LinkedIn post can reach Buffer.');
  }
  if (mediaUrl && mediaKind === 'image' && safeZoneQa !== 'pass') {
    throw new Error('SAFE_ZONE_QA: PASS is required for image posts after inspecting the native-resolution creative.');
  }

  const documentTitle = String(header.DOCUMENT_TITLE || '').trim();
  if (mediaUrl && mediaKind === 'document' && !documentTitle) throw new Error('DOCUMENT_TITLE is required for a LinkedIn PDF carousel.');
  const documentThumbnailUrl = mediaKind === 'document' ? validateStableMediaUrl(header.DOCUMENT_THUMBNAIL_URL, 'DOCUMENT_THUMBNAIL_URL') : null;
  if (mediaUrl && mediaKind === 'document' && !documentThumbnailUrl) throw new Error('DOCUMENT_THUMBNAIL_URL is required for a LinkedIn PDF carousel.');
  const channels = targets.map((target) => {
    const secretName = TARGET_SECRET_NAMES[target];
    const id = env[secretName];
    if (!id) throw new Error(`Missing ${secretName} repository secret.`);
    return {
      target,
      name: TARGET_LABELS[target],
      id,
      text: resolveCopy(copy, target),
      dueAt: resolveSchedule(header, target, mode, now),
    };
  });

  return {
    postId: header.POST_ID || null,
    revision: header.REVISION || '1',
    category: header.CATEGORY || 'uncategorised',
    mode,
    mediaUrl,
    mediaKind,
    contentQa,
    safeZoneQa,
    documentTitle,
    documentThumbnailUrl,
    channels,
  };
}

function tripleTwoPageAnnotations(channel) {
  if (channel.target === 'main') return [];
  const needle = TRIPLE_TWO_LINKEDIN_PAGE.localizedName;
  const start = String(channel.text || '').indexOf(needle);
  if (start < 0) return [];
  return [{
    ...TRIPLE_TWO_LINKEDIN_PAGE,
    start,
    length: needle.length,
  }];
}

function buildCreatePostMutation(channel, mode, media = null) {
  const fields = [
    `text: ${JSON.stringify(channel.text)}`,
    `channelId: ${JSON.stringify(channel.id)}`,
    'schedulingType: automatic',
  ];

  if (mode === 'schedule') {
    fields.push('mode: customScheduled');
    fields.push(`dueAt: ${JSON.stringify(channel.dueAt)}`);
  } else {
    fields.push('mode: addToQueue');
    if (mode === 'draft') fields.push('saveToDraft: true');
  }

  const annotations = tripleTwoPageAnnotations(channel);
  if (annotations.length) {
    const annotationFields = annotations.map((annotation) => `{
      id: ${JSON.stringify(annotation.id)},
      link: ${JSON.stringify(annotation.link)},
      entity: ${JSON.stringify(annotation.entity)},
      vanityName: ${JSON.stringify(annotation.vanityName)},
      localizedName: ${JSON.stringify(annotation.localizedName)},
      start: ${annotation.start},
      length: ${annotation.length}
    }`);
    fields.push(`metadata: { linkedin: { annotations: [${annotationFields.join(', ')}] } }`);
  }

  const normalisedMedia = typeof media === 'string' ? { url: media, kind: 'image' } : media;
  if (normalisedMedia?.url && normalisedMedia.kind === 'document') {
    fields.push(`assets: [{ document: { url: ${JSON.stringify(normalisedMedia.url)}, title: ${JSON.stringify(normalisedMedia.title)}, thumbnailUrl: ${JSON.stringify(normalisedMedia.thumbnailUrl)} } }]`);
  } else if (normalisedMedia?.url) {
    fields.push(`assets: [{ image: { url: ${JSON.stringify(normalisedMedia.url)} } }]`);
  }

  return `
    mutation CreatePost {
      createPost(input: {
        ${fields.join(',\n        ')}
      }) {
        ... on PostActionSuccess { post { id text assets { id mimeType } } }
        ... on MutationError { message }
      }
    }
  `;
}

module.exports = {
  TARGET_LABELS,
  TARGET_SECRET_NAMES,
  TRIPLE_TWO_LINKEDIN_PAGE,
  buildCreatePostMutation,
  normaliseTargets,
  parseIssueBody,
  resolveCopy,
  resolveSchedule,
  tripleTwoPageAnnotations,
  validateHttpsUrl,
  validateStableMediaUrl,
  validateRequest,
};
