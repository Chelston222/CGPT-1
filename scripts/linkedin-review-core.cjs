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

  const mediaUrl = validateHttpsUrl(header.MEDIA_URL);
  const mediaKind = (header.MEDIA_KIND || (mediaUrl && /\.pdf(?:$|\?)/i.test(mediaUrl) ? 'document' : 'image')).toLowerCase();
  if (!['image', 'document'].includes(mediaKind)) throw new Error('MEDIA_KIND must be image or document.');
  const documentTitle = String(header.DOCUMENT_TITLE || '').trim();
  if (mediaUrl && mediaKind === 'document' && !documentTitle) throw new Error('DOCUMENT_TITLE is required for a LinkedIn PDF carousel.');
  const documentThumbnailUrl = mediaKind === 'document' ? validateHttpsUrl(header.DOCUMENT_THUMBNAIL_URL, 'DOCUMENT_THUMBNAIL_URL') : null;
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
    documentTitle,
    documentThumbnailUrl,
    channels,
  };
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
  buildCreatePostMutation,
  normaliseTargets,
  parseIssueBody,
  resolveCopy,
  resolveSchedule,
  validateHttpsUrl,
  validateRequest,
};
