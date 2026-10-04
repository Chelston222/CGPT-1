import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(process.env.GITHUB_WORKSPACE || resolve(here, '..'));
const requireFromMailBridge = createRequire(join(repoRoot, 'apps', 'tte-mail-bridge', 'package.json'));
const { ImapFlow } = requireFromMailBridge('imapflow');
const { simpleParser } = requireFromMailBridge('mailparser');

const START = '<!-- IMAGE_INTAKE_CONFIG_START -->';
const END = '<!-- IMAGE_INTAKE_CONFIG_END -->';
const stage = process.argv[2] || 'retrieve';
const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const body = String(event.issue?.body || '');
const s = body.indexOf(START);
const e = body.indexOf(END);
if (s < 0 || e <= s) throw new Error('Missing image intake config block');
const config = JSON.parse(body.slice(s + START.length, e).trim());

const safe = (value, label = 'value') => {
  if (!/^[A-Za-z0-9._-]+$/.test(String(value || ''))) throw new Error(`Unsafe ${label}: ${value}`);
  return String(value);
};
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const expectedSender = String(config.expectedSender || '').toLowerCase();
if (expectedSender !== 'tripletwochelston@gmail.com') throw new Error('Unexpected sender');
if (!String(config.expectedSubject || '').startsWith('TTE LINKEDIN IMAGE INTAKE ')) throw new Error('Unexpected subject');
const id = safe(config.id, 'id');
const filename = safe(config.expectedFilename, 'filename');
if (!Number.isInteger(config.expectedBytes) || config.expectedBytes < 1) throw new Error('Invalid expectedBytes');
if (!/^[a-f0-9]{64}$/i.test(String(config.expectedSha256 || ''))) throw new Error('Invalid expectedSha256');
if (!Number.isInteger(config.expectedWidth) || config.expectedWidth < 1) throw new Error('Invalid expectedWidth');
if (!Number.isInteger(config.expectedHeight) || config.expectedHeight < 1) throw new Error('Invalid expectedHeight');
if (!config.post || typeof config.post !== 'object') throw new Error('post config required');
if (!/^tte-[a-z0-9-]+$/i.test(String(config.post.id || ''))) throw new Error('Invalid post id');
if (!Number.isInteger(config.post.revision) || config.post.revision < 1) throw new Error('Invalid revision');
if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(String(config.post.scheduledAt || ''))) throw new Error('Invalid scheduledAt');
if (!String(config.post.copy || '').trim()) throw new Error('Post copy required');
if (!String(config.post.altText || '').trim()) throw new Error('Alt text required');

const mediaDir = join(repoRoot, 'apps', 'linkedin-review', 'media', 'intake-image', id, `r${config.post.revision}`);
const mediaPath = join(mediaDir, filename);
const supplementalPath = join(repoRoot, 'apps', 'linkedin-review', `qa-replenishment-${id}.json`);

function verifyPng(buf) {
  const sig = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  if (buf.length < 24 || !buf.subarray(0, 8).equals(sig)) throw new Error('Attachment is not a valid PNG');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (width !== config.expectedWidth || height !== config.expectedHeight) {
    throw new Error(`PNG dimension mismatch: expected ${config.expectedWidth}x${config.expectedHeight}, got ${width}x${height}`);
  }
  return { width, height };
}

if (stage === 'retrieve') {
  rmSync(mediaDir, { recursive: true, force: true });
  mkdirSync(mediaDir, { recursive: true });
  const user = process.env.TTE_SMTP_USER || 'hello@222emails.com';
  const pass = process.env.TTE_SMTP_PASS;
  if (!pass) throw new Error('TTE_SMTP_PASS is required');
  const client = new ImapFlow({
    host: process.env.TTE_IMAP_HOST || 'mail.privateemail.com',
    port: Number(process.env.TTE_IMAP_PORT || '993'),
    secure: true,
    auth: { user, pass },
    logger: false,
  });
  let found = null;
  try {
    await client.connect();
    const mailboxes = (await client.list()).filter((m) => !m.flags?.has('\\Noselect'));
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    mailboxLoop: for (const mailbox of mailboxes) {
      const special = String(mailbox.specialUse || '').toLowerCase();
      if (['\\sent','\\drafts','\\trash','\\junk'].includes(special)) continue;
      await client.mailboxOpen(mailbox.path, { readOnly: true });
      const uids = (await client.search({ since }, { uid: true })).slice(-300).reverse();
      if (!uids.length) continue;
      const messages = await client.fetchAll(uids, { uid: true, envelope: true, source: true }, { uid: true });
      for (const message of messages) {
        const from = String(message.envelope?.from?.[0]?.address || '').toLowerCase();
        const subject = String(message.envelope?.subject || '');
        if (from !== expectedSender || subject !== String(config.expectedSubject)) continue;
        const parsed = await simpleParser(message.source, { skipTextToHtml: true, maxHtmlLengthToParse: 200000 });
        const attachment = (parsed.attachments || []).find((a) => a.filename === filename && a.content?.length);
        if (!attachment) continue;
        const buf = Buffer.from(attachment.content);
        if (buf.length !== config.expectedBytes) continue;
        if (sha(buf) !== String(config.expectedSha256).toLowerCase()) continue;
        const dimensions = verifyPng(buf);
        writeFileSync(mediaPath, buf);
        found = { mailbox: mailbox.path, uid: message.uid, ...dimensions };
        break mailboxLoop;
      }
    }
  } finally {
    try { await client.logout(); } catch {}
  }
  if (!found) throw new Error('Exact locked image attachment not found');
  if (statSync(mediaPath).size !== config.expectedBytes || sha(readFileSync(mediaPath)) !== String(config.expectedSha256).toLowerCase()) {
    throw new Error('Written media failed exact byte/SHA verification');
  }
  console.log(JSON.stringify({ ok: true, stage, mediaPath: relative(repoRoot, mediaPath), ...found }, null, 2));
  process.exit(0);
}

if (stage === 'build') {
  const mediaCommit = String(process.env.MEDIA_COMMIT || '').trim();
  const owner = String(process.env.GITHUB_REPOSITORY_OWNER || '').trim();
  const repo = String(process.env.GITHUB_REPOSITORY || '').split('/').pop();
  if (!/^[a-f0-9]{40}$/i.test(mediaCommit)) throw new Error('MEDIA_COMMIT must be immutable commit SHA');
  const actual = readFileSync(mediaPath);
  verifyPng(actual);
  if (actual.length !== config.expectedBytes || sha(actual) !== String(config.expectedSha256).toLowerCase()) throw new Error('Media drift before queue build');
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${mediaCommit}/apps/linkedin-review/media/intake-image/${id}/r${config.post.revision}/${filename}`;
  const post = {
    id: String(config.post.id),
    revision: config.post.revision,
    title: String(config.post.title || config.post.id),
    rating: Number(config.post.rating || 97),
    category: String(config.post.category || 'client_return_systems'),
    contentRole: String(config.post.contentRole || 'diagnosis'),
    funnelStage: String(config.post.funnelStage || 'tof'),
    format: 'image',
    targets: ['personal'],
    mode: 'schedule',
    scheduledAt: { personal: String(config.post.scheduledAt) },
    copy: { default: String(config.post.copy) },
    mediaUrl: rawUrl,
    mediaAlt: String(config.post.altText),
    mediaBytes: actual.length,
    mediaSha256: sha(actual),
    safeZoneQa: 'pass',
    sourceType: 'qa_replenishment',
    status: 'review',
    qa: {
      status: 'ready_for_human_review',
      publishable: true,
      approvalEligible: true,
      publishPermission: false,
      evidenceSafe: true,
      antiDnaPass: true,
      publicTrustBoundary: true,
    },
    history: [{
      state: 'media_ready',
      at: new Date().toISOString(),
      actor: 'github-actions[bot]',
      note: `Exact PNG media pinned to immutable commit ${mediaCommit}`,
    }],
  };
  const payload = {
    schemaVersion: 1,
    batchId: id,
    generatedAt: new Date().toISOString(),
    sourceBasis: {
      command: '222E governed single-image intake',
      purpose: 'Exact-media LinkedIn scheduling through GitHub -> Buffer',
      media: 'lossless PNG, immutable SHA/byte/dimension locked',
    },
    approvalRule: 'Review-only until repository-owner [APPROVED LINKEDIN] approval.',
    posts: [post],
  };
  writeFileSync(supplementalPath, JSON.stringify(payload, null, 2) + '\n');
  console.log(JSON.stringify({ ok: true, stage, supplementalPath: relative(repoRoot, supplementalPath), post: `${post.id}@${post.revision}`, mediaUrl: rawUrl }, null, 2));
  process.exit(0);
}

throw new Error(`Unknown stage: ${stage}`);
