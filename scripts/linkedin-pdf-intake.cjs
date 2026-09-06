'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const childProcess = require('node:child_process');

const MAX_DOCUMENT_BYTES = 100_000_000;
const MAX_DOCUMENT_PAGES = 300;
const ALLOWED_TARGETS = new Set(['personal', 'main', 'secondary']);
const EXPLICIT_ZONE_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const COMMIT_SHA = /^[a-f0-9]{40}$/i;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function safeId(value) {
  const id = String(value || '').trim();
  assert(/^[a-z0-9][a-z0-9-]{2,79}$/i.test(id), 'manifest.id must be 3-80 alphanumeric/hyphen characters.');
  return id;
}

function isPrivateAddress(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.local')) return true;
  const family = net.isIP(host);
  if (family === 4) {
    const parts = host.split('.').map(Number);
    const [a, b] = parts;
    return a === 0
      || a === 10
      || a === 127
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19));
  }
  if (family === 6) {
    return host === '::1'
      || host === '::'
      || host.startsWith('fc')
      || host.startsWith('fd')
      || host.startsWith('fe8')
      || host.startsWith('fe9')
      || host.startsWith('fea')
      || host.startsWith('feb');
  }
  return false;
}

function validateDownloadUrl(value) {
  const raw = String(value || '').trim();
  assert(raw, 'manifest.downloadUrl must be a non-empty HTTPS URL.');
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('manifest.downloadUrl must be a valid HTTPS URL.');
  }
  assert(parsed.protocol === 'https:', 'manifest.downloadUrl must use HTTPS.');
  assert(!parsed.username && !parsed.password, 'manifest.downloadUrl must not contain URL credentials.');
  assert(!isPrivateAddress(parsed.hostname), 'manifest.downloadUrl must not target a local or private address.');
  return parsed.toString();
}

function loadManifest(filePath) {
  const manifest = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert(manifest.schemaVersion === 1, 'Unsupported PDF intake manifest schemaVersion.');
  manifest.id = safeId(manifest.id);
  assert(Number.isSafeInteger(manifest.revision) && manifest.revision >= 1, 'manifest.revision must be an explicit positive integer.');
  assert(String(manifest.title || '').trim(), 'manifest.title is required.');
  assert(String(manifest.documentTitle || '').trim(), 'manifest.documentTitle is required.');
  assert(String(manifest.copy?.default || '').trim(), 'manifest.copy.default is required.');
  assert(!String(manifest.copy.default).includes('\u2014'), 'manifest.copy.default must not contain em dashes.');
  assert(Array.isArray(manifest.targets) && manifest.targets.length, 'manifest.targets must contain at least one destination.');
  assert(manifest.targets.every((target) => ALLOWED_TARGETS.has(target)), 'manifest.targets contains an unsupported destination.');
  assert(new Set(manifest.targets).size === manifest.targets.length, 'manifest.targets must not contain duplicate destinations.');
  assert(manifest.publicMediaApproved === true, 'manifest.publicMediaApproved must be true because promoted media is publicly reachable before publication.');

  const hasChunks = Array.isArray(manifest.chunks) && manifest.chunks.length > 0;
  const hasDownloadUrl = Boolean(String(manifest.downloadUrl || '').trim());
  assert(hasChunks !== hasDownloadUrl, 'manifest must provide exactly one PDF transport: chunks or downloadUrl.');
  if (hasChunks) {
    assert(manifest.chunks.every((chunk) => typeof chunk === 'string' && chunk.endsWith('.b64')), 'Every manifest chunk must be a .b64 repository path.');
  } else {
    manifest.downloadUrl = validateDownloadUrl(manifest.downloadUrl);
    assert(manifest.expectedSha256, 'manifest.expectedSha256 is required when downloadUrl is used.');
  }

  if (manifest.expectedSha256) assert(/^[a-f0-9]{64}$/i.test(manifest.expectedSha256), 'manifest.expectedSha256 must be a SHA-256 hex digest.');
  if (manifest.mode && !['draft', 'schedule'].includes(manifest.mode)) throw new Error('manifest.mode must be draft or schedule.');
  if ((manifest.mode || 'draft') === 'schedule') {
    assert(manifest.scheduledAt && typeof manifest.scheduledAt === 'object' && !Array.isArray(manifest.scheduledAt), 'scheduledAt is required in schedule mode.');
    for (const target of manifest.targets) {
      const raw = String(manifest.scheduledAt[target] || '').trim();
      assert(EXPLICIT_ZONE_ISO.test(raw), `scheduledAt.${target} must use ISO 8601 with an explicit Z or UTC offset.`);
      assert(!Number.isNaN(Date.parse(raw)), `scheduledAt.${target} must be a valid ISO date/time.`);
    }
  }
  return manifest;
}

function verifyPdfFile(pdfPath, expectedSha256) {
  const stat = fs.statSync(pdfPath);
  assert(stat.size > 0, 'PDF transport produced an empty file.');
  assert(stat.size <= MAX_DOCUMENT_BYTES, `PDF exceeds ${MAX_DOCUMENT_BYTES} bytes.`);
  const bytes = stat.size;
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(pdfPath)).digest('hex');
  if (expectedSha256) assert(sha256 === String(expectedSha256).toLowerCase(), `PDF SHA-256 mismatch: expected ${expectedSha256}, got ${sha256}.`);
  const signature = fs.readFileSync(pdfPath).subarray(0, 5).toString('ascii');
  assert(signature === '%PDF-', 'Transported file is not a PDF.');
  return { bytes, sha256 };
}

function decodeChunks(root, manifest, outputPdf) {
  const fd = fs.openSync(outputPdf, 'w');
  let bytes = 0;
  try {
    for (const relative of manifest.chunks) {
      const abs = path.resolve(root, relative);
      assert(abs.startsWith(path.resolve(root) + path.sep), `Chunk escapes repository root: ${relative}`);
      assert(fs.existsSync(abs), `Missing PDF chunk: ${relative}`);
      const text = fs.readFileSync(abs, 'utf8').replace(/\s+/g, '');
      assert(/^[A-Za-z0-9+/=]+$/.test(text), `Chunk is not valid base64 text: ${relative}`);
      const buf = Buffer.from(text, 'base64');
      assert(buf.length, `Decoded chunk is empty: ${relative}`);
      fs.writeSync(fd, buf);
      bytes += buf.length;
      assert(bytes <= MAX_DOCUMENT_BYTES, `PDF exceeds ${MAX_DOCUMENT_BYTES} bytes.`);
    }
  } finally {
    fs.closeSync(fd);
  }
  return verifyPdfFile(outputPdf, manifest.expectedSha256);
}

function downloadPdf(manifest, outputPdf) {
  const url = validateDownloadUrl(manifest.downloadUrl);
  childProcess.execFileSync('curl', [
    '--fail',
    '--location',
    '--silent',
    '--show-error',
    '--retry', '3',
    '--retry-delay', '1',
    '--proto', '=https',
    '--proto-redir', '=https',
    '--max-filesize', String(MAX_DOCUMENT_BYTES),
    '--output', outputPdf,
    url,
  ], { stdio: 'inherit' });
  return verifyPdfFile(outputPdf, manifest.expectedSha256);
}

function inspectPdf(pdfPath) {
  const output = childProcess.execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
  const match = output.match(/^Pages:\s+(\d+)/m);
  assert(match, 'pdfinfo did not return a page count.');
  const pageCount = Number(match[1]);
  assert(pageCount >= 1 && pageCount <= MAX_DOCUMENT_PAGES, `PDF page count must be 1-${MAX_DOCUMENT_PAGES}.`);
  return { pageCount };
}

function renderThumbnail(pdfPath, jpgPath) {
  const prefix = jpgPath.replace(/\.jpg$/i, '');
  childProcess.execFileSync('pdftoppm', ['-f', '1', '-singlefile', '-jpeg', '-jpegopt', 'quality=92', '-scale-to-x', '1200', '-scale-to-y', '-1', pdfPath, prefix]);
  assert(fs.existsSync(jpgPath) && fs.statSync(jpgPath).size > 0, 'Failed to create PDF thumbnail.');
}

function rawUrl(owner, repo, ref, relativePath) {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${relativePath.split(path.sep).map(encodeURIComponent).join('/')}`;
}

function rawGitHubRef(value) {
  try {
    const parsed = new URL(String(value || ''));
    if (parsed.hostname.toLowerCase() !== 'raw.githubusercontent.com') return null;
    const parts = parsed.pathname.split('/').filter(Boolean);
    return parts.length >= 4 ? parts[2] : null;
  } catch {
    return null;
  }
}

function stableMediaIdentity(value) {
  try {
    const parsed = new URL(String(value || ''));
    if (parsed.hostname.toLowerCase() !== 'raw.githubusercontent.com') return parsed.toString();
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length < 4) return parsed.toString();
    return `https://raw.githubusercontent.com/${parts[0]}/${parts[1]}/<immutable-ref>/${parts.slice(3).join('/')}`;
  } catch {
    return String(value || '');
  }
}

function buildQueuePost(manifest, metadata, urls, nowIso) {
  const mode = manifest.mode || 'draft';
  const transport = manifest.downloadUrl ? 'approved HTTPS binary bridge' : 'locked base64 chunks';
  const post = {
    id: manifest.id,
    revision: manifest.revision,
    title: String(manifest.title).trim(),
    category: manifest.category || 'buyer_diagnostics',
    funnelStage: manifest.funnelStage || 'mof',
    format: 'carousel',
    targets: manifest.targets,
    mode,
    copy: manifest.copy,
    mediaPreviewUrl: urls.thumbnailUrl,
    mediaAlt: manifest.mediaAlt || `Cover of LinkedIn PDF carousel: ${manifest.documentTitle}`,
    mediaUrl: urls.pdfUrl,
    documentTitle: String(manifest.documentTitle).trim(),
    documentThumbnailUrl: urls.thumbnailUrl,
    carousel: {
      libraryId: manifest.libraryId || manifest.id,
      slideCount: metadata.pageCount,
      readiness: 'ready',
      pdfBytes: metadata.bytes,
      pdfSha256: metadata.sha256,
      verifiedAt: nowIso,
      sourceFolder: manifest.sourceFolder || `ChatGPT PDF intake ${manifest.id}`,
      publicMediaApproved: true,
    },
    sourceUrl: manifest.sourceUrl || 'https://github.com/Chelston222/CGPT-1/issues/514',
    sourceType: 'chatgpt_pdf_intake',
    status: 'review',
    history: [{
      state: 'media_ready',
      at: nowIso,
      actor: 'github-actions[bot]',
      note: `PDF reconstructed from ${transport}, verified against its locked SHA-256, thumbnailed and promoted into the governed LinkedIn queue. No publish authority implied.`,
    }],
  };
  if (mode === 'schedule') post.scheduledAt = manifest.scheduledAt;
  return post;
}

function stablePostFingerprint(post) {
  return JSON.stringify({
    id: post.id,
    revision: Number(post.revision),
    title: post.title,
    category: post.category,
    funnelStage: post.funnelStage,
    format: post.format,
    targets: post.targets,
    mode: post.mode,
    scheduledAt: post.scheduledAt || null,
    copy: post.copy,
    mediaAlt: post.mediaAlt,
    mediaUrl: stableMediaIdentity(post.mediaUrl),
    documentTitle: post.documentTitle,
    documentThumbnailUrl: stableMediaIdentity(post.documentThumbnailUrl),
    slideCount: post.carousel?.slideCount || null,
    pdfBytes: post.carousel?.pdfBytes || null,
    pdfSha256: post.carousel?.pdfSha256 || null,
    sourceUrl: post.sourceUrl,
    sourceType: post.sourceType,
  });
}

function upsertQueue(queuePath, post, nowIso) {
  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  assert(Array.isArray(queue.posts), 'queue.json posts array is missing.');
  const index = queue.posts.findIndex((item) => item.id === post.id);
  if (index >= 0) {
    const current = queue.posts[index];
    const currentRevision = Number(current.revision);
    const nextRevision = Number(post.revision);
    if (nextRevision === currentRevision) {
      assert(stablePostFingerprint(current) === stablePostFingerprint(post), `Existing ${post.id}@${current.revision} conflicts with the requested same revision. Use a higher revision for any changed copy, schedule or media.`);
      return { changed: false, replay: true };
    }
    assert(nextRevision > currentRevision, `Existing ${post.id}@${current.revision} requires a strictly higher revision.`);
    queue.posts[index] = post;
  } else {
    queue.posts.push(post);
  }
  queue.generatedAt = nowIso;
  fs.writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`);
  return { changed: true, replay: false };
}

function snapshotFile(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
}

function restoreGovernedMediaOnReplay({ queueResult, pdfPath, jpgPath, existingPdf, existingJpg, metadata }) {
  if (!queueResult?.replay) return false;
  assert(Buffer.isBuffer(existingPdf) && existingPdf.length > 0, 'Idempotent replay requires the previously governed PDF bytes to exist.');
  assert(Buffer.isBuffer(existingJpg) && existingJpg.length > 0, 'Idempotent replay requires the previously governed thumbnail bytes to exist.');
  const governedSha256 = crypto.createHash('sha256').update(existingPdf).digest('hex');
  assert(existingPdf.length === metadata.bytes, `Existing governed replay PDF byte count drifted: expected ${metadata.bytes}, found ${existingPdf.length}.`);
  assert(governedSha256 === metadata.sha256, `Existing governed replay PDF SHA-256 drifted: expected ${metadata.sha256}, found ${governedSha256}.`);
  fs.writeFileSync(pdfPath, existingPdf);
  fs.writeFileSync(jpgPath, existingJpg);
  return true;
}

function pinQueueMediaUrls(queuePath, { id, revision, owner, repo, ref, nowIso = new Date().toISOString() }) {
  assert(owner && repo, 'owner and repo are required for media URL pinning.');
  assert(COMMIT_SHA.test(String(ref || '')), 'media URL pinning requires a full 40-character Git commit SHA.');
  const postId = safeId(id);
  const rev = Number(revision);
  assert(Number.isSafeInteger(rev) && rev >= 1, 'revision must be a positive integer for media URL pinning.');

  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  assert(Array.isArray(queue.posts), 'queue.json posts array is missing.');
  const post = queue.posts.find((item) => item.id === postId && Number(item.revision) === rev);
  assert(post, `Cannot pin media URL because ${postId}@${rev} is not in the governed queue.`);
  assert(post.sourceType === 'chatgpt_pdf_intake', `Cannot pin non-intake queue item ${postId}@${rev}.`);
  assert(post.carousel?.pdfSha256 && post.carousel?.pdfBytes, `Cannot pin ${postId}@${rev} without locked PDF integrity metadata.`);

  const existingRef = rawGitHubRef(post.mediaUrl);
  if (existingRef && COMMIT_SHA.test(existingRef)) {
    return {
      changed: false,
      replay: true,
      ref: existingRef,
      pdfUrl: post.mediaUrl,
      thumbnailUrl: post.documentThumbnailUrl,
    };
  }

  const base = path.join('apps', 'linkedin-review', 'media', 'intake', postId, `r${rev}`);
  const pdfUrl = rawUrl(owner, repo, ref, path.join(base, `${postId}.pdf`));
  const thumbnailUrl = rawUrl(owner, repo, ref, path.join(base, 'thumbnail.jpg'));
  post.mediaUrl = pdfUrl;
  post.mediaPreviewUrl = thumbnailUrl;
  post.documentThumbnailUrl = thumbnailUrl;
  post.history = Array.isArray(post.history) ? post.history : [];
  post.history.push({
    state: 'media_urls_pinned',
    at: nowIso,
    actor: 'github-actions[bot]',
    note: `Governed PDF and thumbnail URLs pinned to immutable Git commit ${ref}.`,
  });
  queue.generatedAt = nowIso;
  fs.writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`);
  return { changed: true, replay: false, ref, pdfUrl, thumbnailUrl };
}

function run({ root = process.cwd(), manifestPath, owner, repo, branch = 'main' }) {
  assert(manifestPath, 'manifestPath is required.');
  assert(owner && repo, 'owner and repo are required.');
  const manifestAbs = path.resolve(root, manifestPath);
  const manifest = loadManifest(manifestAbs);
  const revisionDir = `r${manifest.revision}`;
  const intakeDir = path.join(root, 'apps', 'linkedin-review', 'media', 'intake', manifest.id, revisionDir);
  fs.mkdirSync(intakeDir, { recursive: true });
  const pdfPath = path.join(intakeDir, `${manifest.id}.pdf`);
  const jpgPath = path.join(intakeDir, 'thumbnail.jpg');
  const existingPdf = snapshotFile(pdfPath);
  const existingJpg = snapshotFile(jpgPath);
  const measured = manifest.downloadUrl ? downloadPdf(manifest, pdfPath) : decodeChunks(root, manifest, pdfPath);
  const inspected = inspectPdf(pdfPath);
  renderThumbnail(pdfPath, jpgPath);
  const metadata = { ...measured, ...inspected };
  const pdfRelative = path.relative(root, pdfPath);
  const jpgRelative = path.relative(root, jpgPath);
  const urls = {
    pdfUrl: rawUrl(owner, repo, branch, pdfRelative),
    thumbnailUrl: rawUrl(owner, repo, branch, jpgRelative),
  };
  const nowIso = new Date().toISOString();
  const queuePath = path.join(root, 'apps', 'linkedin-review', 'queue.json');
  const post = buildQueuePost(manifest, metadata, urls, nowIso);
  const queueResult = upsertQueue(queuePath, post, nowIso);
  const replayMediaRestored = restoreGovernedMediaOnReplay({ queueResult, pdfPath, jpgPath, existingPdf, existingJpg, metadata });
  const manifestAudit = { ...manifest };
  if (manifestAudit.downloadUrl) manifestAudit.downloadUrl = '[redacted]';
  return { manifest: manifestAudit, metadata, urls, post, queueResult, replayMediaRestored, pdfRelative, jpgRelative, queuePath };
}

if (require.main === module) {
  const manifestPath = process.argv[2];
  const result = run({
    root: process.env.GITHUB_WORKSPACE || process.cwd(),
    manifestPath,
    owner: process.env.GITHUB_REPOSITORY_OWNER,
    repo: String(process.env.GITHUB_REPOSITORY || '').split('/')[1],
    branch: process.env.GITHUB_REF_NAME || 'main',
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

module.exports = {
  COMMIT_SHA,
  EXPLICIT_ZONE_ISO,
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENT_PAGES,
  buildQueuePost,
  decodeChunks,
  downloadPdf,
  loadManifest,
  pinQueueMediaUrls,
  rawGitHubRef,
  rawUrl,
  restoreGovernedMediaOnReplay,
  run,
  safeId,
  snapshotFile,
  stableMediaIdentity,
  stablePostFingerprint,
  upsertQueue,
  validateDownloadUrl,
  verifyPdfFile,
};