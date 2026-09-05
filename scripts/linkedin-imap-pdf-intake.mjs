import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(process.env.GITHUB_WORKSPACE || resolve(here, '..'));
const requireFromMailBridge = createRequire(join(repoRoot, 'apps', 'tte-mail-bridge', 'package.json'));
const { ImapFlow } = requireFromMailBridge('imapflow');
const { simpleParser } = requireFromMailBridge('mailparser');

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const user = process.env.TTE_SMTP_USER || 'hello@222emails.com';
const pass = required('TTE_SMTP_PASS');
const host = process.env.TTE_IMAP_HOST || 'mail.privateemail.com';
const port = Number(process.env.TTE_IMAP_PORT || '993');
const id = required('TTE_LINKEDIN_INTAKE_ID');
const expectedSubject = required('TTE_LINKEDIN_INTAKE_SUBJECT');
const expectedSender = required('TTE_LINKEDIN_INTAKE_SENDER').toLowerCase();
const expectedFilename = required('TTE_LINKEDIN_INTAKE_FILENAME');
const expectedSha256 = required('TTE_LINKEDIN_INTAKE_SHA256').toLowerCase();
const expectedBytes = Number(required('TTE_LINKEDIN_INTAKE_BYTES'));
const manifestTemplate = JSON.parse(required('TTE_LINKEDIN_MANIFEST_JSON'));

if (!/^[a-z0-9][a-z0-9-]{2,79}$/i.test(id)) throw new Error('Invalid intake ID');
if (!/^[a-f0-9]{64}$/.test(expectedSha256)) throw new Error('Invalid expected SHA-256');
if (!Number.isSafeInteger(expectedBytes) || expectedBytes < 1 || expectedBytes > 100_000_000) throw new Error('Invalid expected byte count');

const stagingDir = join(repoRoot, 'media-staging', 'pdf-intake', id);
rmSync(stagingDir, { recursive: true, force: true });
mkdirSync(stagingDir, { recursive: true });

const client = new ImapFlow({ host, port, secure: true, auth: { user, pass }, logger: false });
let selected = null;
try {
  await client.connect();
  const mailboxes = await client.list();
  const selectable = mailboxes.filter((mb) => !mb.flags?.has('\\Noselect'));
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000);

  for (const mailbox of selectable) {
    const special = String(mailbox.specialUse || '').toLowerCase();
    if (['\\sent', '\\drafts', '\\trash', '\\junk'].includes(special)) continue;
    await client.mailboxOpen(mailbox.path, { readOnly: true });
    const recent = await client.search({ since }, { uid: true });
    const uids = recent.slice(-200);
    if (!uids.length) continue;
    const messages = await client.fetchAll(uids, { uid: true, envelope: true, source: true }, { uid: true });
    for (const message of messages) {
      const from = String(message.envelope?.from?.[0]?.address || '').toLowerCase();
      const subject = String(message.envelope?.subject || '');
      if (from !== expectedSender || subject !== expectedSubject) continue;
      const parsed = await simpleParser(message.source, { skipTextToHtml: true, maxHtmlLengthToParse: 150000 });
      const attachment = (parsed.attachments || []).find((item) => item.filename === expectedFilename && item.contentType === 'application/pdf');
      if (!attachment?.content?.length) continue;
      selected = { mailbox: mailbox.path, uid: message.uid, attachment };
    }
  }
} finally {
  try { await client.logout(); } catch {}
}

if (!selected) throw new Error(`Exact intake email/attachment not found: sender=${expectedSender} subject=${expectedSubject} filename=${expectedFilename}`);

const pdf = Buffer.from(selected.attachment.content);
if (pdf.length !== expectedBytes) throw new Error(`Byte mismatch: expected ${expectedBytes}, got ${pdf.length}`);
if (pdf.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Attachment is not a PDF');
const sha256 = createHash('sha256').update(pdf).digest('hex');
if (sha256 !== expectedSha256) throw new Error(`SHA-256 mismatch: expected ${expectedSha256}, got ${sha256}`);

const chunkPaths = [];
const chunkBytes = 2_000_000;
for (let offset = 0, index = 1; offset < pdf.length; offset += chunkBytes, index += 1) {
  const chunkPath = join(stagingDir, `part-${String(index).padStart(3, '0')}.b64`);
  writeFileSync(chunkPath, pdf.subarray(offset, Math.min(offset + chunkBytes, pdf.length)).toString('base64'), 'utf8');
  chunkPaths.push(relative(repoRoot, chunkPath).split('\\').join('/'));
}

const manifest = {
  ...manifestTemplate,
  schemaVersion: 1,
  id,
  expectedSha256,
  chunks: chunkPaths,
};
delete manifest.downloadUrl;
const manifestPath = join(stagingDir, 'manifest.json');
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const outputPath = process.env.GITHUB_OUTPUT;
if (outputPath) {
  writeFileSync(outputPath, `manifest_path=${relative(repoRoot, manifestPath).split('\\').join('/')}\nsource_mailbox=${selected.mailbox}\nsource_uid=${selected.uid}\nbytes=${pdf.length}\nsha256=${sha256}\nchunks=${chunkPaths.length}\n`, { flag: 'a' });
}

console.log(JSON.stringify({ ok: true, id, mailbox: selected.mailbox, uid: selected.uid, bytes: pdf.length, sha256, chunks: chunkPaths.length, manifestPath: relative(repoRoot, manifestPath) }, null, 2));
