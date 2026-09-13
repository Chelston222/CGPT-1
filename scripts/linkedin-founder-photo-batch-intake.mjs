import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(process.env.GITHUB_WORKSPACE || resolve(here, '..'));
const requireFromMailBridge = createRequire(join(repoRoot, 'apps', 'tte-mail-bridge', 'package.json'));
const { ImapFlow } = requireFromMailBridge('imapflow');
const { simpleParser } = requireFromMailBridge('mailparser');

const START = '<!-- FOUNDER_BATCH_CONFIG_START -->';
const END = '<!-- FOUNDER_BATCH_CONFIG_END -->';
const stage = process.argv[2] || 'retrieve';
const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const body = String(event.issue?.body || '');
const s = body.indexOf(START), e = body.indexOf(END);
if (s < 0 || e <= s) throw new Error('Missing founder batch config block');
const config = JSON.parse(body.slice(s + START.length, e).trim());
if (!/^[a-z0-9][a-z0-9-]{2,79}$/i.test(config.id || '')) throw new Error('Invalid batch id');
if (String(config.expectedSender || '').toLowerCase() !== 'tripletwochelston@gmail.com') throw new Error('Unexpected sender');
if (!String(config.expectedSubject || '').startsWith('TTE LINKEDIN FOUNDER MEDIA INTAKE ')) throw new Error('Unexpected subject');
if (!Array.isArray(config.attachments) || !config.attachments.length) throw new Error('attachments required');
if (!Array.isArray(config.posts) || config.posts.length !== 10) throw new Error('Exactly 10 founder posts required');

const mediaDir = join(repoRoot, 'apps', 'linkedin-review', 'media', 'founder', config.id);
const supplementalPath = join(repoRoot, 'apps', 'linkedin-review', `qa-replenishment-${config.id}.json`);
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const safe = (name) => { if (!/^[A-Za-z0-9._-]+$/.test(name)) throw new Error(`Unsafe filename ${name}`); return name; };

if (stage === 'retrieve') {
  rmSync(mediaDir, { recursive: true, force: true });
  mkdirSync(mediaDir, { recursive: true });
  const expected = new Map(config.attachments.map((a) => [safe(a.filename), a]));
  for (const a of expected.values()) {
    if (!Number.isInteger(a.bytes) || a.bytes < 1 || !/^[a-f0-9]{64}$/i.test(a.sha256 || '')) throw new Error(`Invalid attachment lock for ${a.filename}`);
  }
  const user = process.env.TTE_SMTP_USER || 'hello@222emails.com';
  const pass = process.env.TTE_SMTP_PASS;
  if (!pass) throw new Error('TTE_SMTP_PASS is required');
  const client = new ImapFlow({ host: process.env.TTE_IMAP_HOST || 'mail.privateemail.com', port: Number(process.env.TTE_IMAP_PORT || '993'), secure: true, auth: { user, pass }, logger: false });
  let foundMessage = null;
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
        if (from !== String(config.expectedSender).toLowerCase() || subject !== config.expectedSubject) continue;
        const parsed = await simpleParser(message.source, { skipTextToHtml: true, maxHtmlLengthToParse: 200000 });
        const byName = new Map((parsed.attachments || []).filter((x) => x.filename && x.content?.length).map((x) => [x.filename, Buffer.from(x.content)]));
        let ok = true;
        for (const [filename, lock] of expected) {
          const buf = byName.get(filename);
          if (!buf || buf.length !== lock.bytes || sha(buf) !== String(lock.sha256).toLowerCase()) { ok = false; break; }
        }
        if (!ok) continue;
        for (const [filename, lock] of expected) writeFileSync(join(mediaDir, filename), byName.get(filename));
        foundMessage = { mailbox: mailbox.path, uid: message.uid };
        break mailboxLoop;
      }
    }
  } finally { try { await client.logout(); } catch {} }
  if (!foundMessage) throw new Error('Exact founder media email/attachments not found');

  const darwen = config.posts.find((p) => p.format === 'carousel');
  if (darwen) {
    const inputs = darwen.carouselFiles.map((f) => join(mediaDir, safe(f)));
    const pdfPath = join(mediaDir, `${darwen.id}.pdf`);
    execFileSync('img2pdf', [...inputs, '-o', pdfPath], { stdio: 'inherit' });
    copyFileSync(inputs[0], join(mediaDir, `${darwen.id}-thumbnail.jpg`));
  }
  console.log(JSON.stringify({ ok: true, stage, mediaDir: relative(repoRoot, mediaDir), ...foundMessage }, null, 2));
  process.exit(0);
}

if (stage === 'build') {
  const mediaCommit = String(process.env.MEDIA_COMMIT || '').trim();
  const owner = String(process.env.GITHUB_REPOSITORY_OWNER || '').trim();
  const repo = String(process.env.GITHUB_REPOSITORY || '').split('/').pop();
  if (!/^[a-f0-9]{40}$/i.test(mediaCommit)) throw new Error('MEDIA_COMMIT must be immutable commit SHA');
  const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/${mediaCommit}/apps/linkedin-review/media/founder/${config.id}`;
  const posts = config.posts.map((p) => {
    const common = {
      id: p.id,
      revision: Number(p.revision || 1),
      title: p.title,
      category: p.category,
      funnelStage: 'tof',
      targets: ['personal'],
      mode: 'schedule',
      scheduledAt: { personal: p.scheduledAt },
      copy: { default: p.copy },
      sourceType: 'qa_replenishment',
      status: 'review',
      qa: { status: 'ready_for_human_review', approvalEligible: true, publishPermission: false, safeZoneQa: 'pass' },
      history: [{ state: 'media_ready', at: new Date().toISOString(), actor: 'github-actions[bot]', note: `Exact founder media pinned to ${mediaCommit}` }],
    };
    if (p.format === 'carousel') {
      const pdf = join(mediaDir, `${p.id}.pdf`);
      const thumb = join(mediaDir, `${p.id}-thumbnail.jpg`);
      return { ...common, format: 'carousel', mediaUrl: `${rawBase}/${p.id}.pdf`, documentTitle: p.documentTitle || p.title, documentThumbnailUrl: `${rawBase}/${p.id}-thumbnail.jpg`, carousel: { slideCount: Number(p.slideCount || 2), readiness: 'ready', pdfBytes: statSync(pdf).size, pdfSha256: sha(readFileSync(pdf)) }, mediaPreviewUrl: `${rawBase}/${p.carouselFiles[0]}` };
    }
    const filename = safe(p.media);
    const file = join(mediaDir, filename);
    return { ...common, format: 'image', mediaUrl: `${rawBase}/${filename}`, mediaAlt: p.altText, mediaBytes: statSync(file).size, mediaSha256: sha(readFileSync(file)), safeZoneQa: 'pass' };
  });
  writeFileSync(supplementalPath, JSON.stringify({ schemaVersion: 1, batchId: config.id, generatedAt: new Date().toISOString(), posts }, null, 2) + '\n');
  console.log(JSON.stringify({ ok: true, stage, supplementalPath: relative(repoRoot, supplementalPath), posts: posts.map((p) => `${p.id}@${p.revision}`) }, null, 2));
  process.exit(0);
}

throw new Error(`Unknown stage ${stage}`);
