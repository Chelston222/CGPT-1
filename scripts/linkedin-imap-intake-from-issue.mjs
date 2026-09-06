import { appendFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(process.env.GITHUB_WORKSPACE || resolve(here, '..'));
const require = createRequire(import.meta.url);
const { parseIntakeIssue } = require('./linkedin-imap-intake-config.cjs');

const eventPath = process.env.GITHUB_EVENT_PATH;
if (!eventPath) throw new Error('GITHUB_EVENT_PATH is required.');
const event = JSON.parse(readFileSync(eventPath, 'utf8'));
const issue = event.issue || {};
const config = parseIntakeIssue(issue.title, issue.body, Date.now());

process.env.TTE_LINKEDIN_INTAKE_ID = config.id;
process.env.TTE_LINKEDIN_INTAKE_SUBJECT = config.expectedSubject;
process.env.TTE_LINKEDIN_INTAKE_SENDER = config.expectedSender;
process.env.TTE_LINKEDIN_INTAKE_FILENAME = config.expectedFilename;
process.env.TTE_LINKEDIN_INTAKE_SHA256 = config.expectedSha256;
process.env.TTE_LINKEDIN_INTAKE_BYTES = String(config.expectedBytes);
process.env.TTE_LINKEDIN_MANIFEST_JSON = JSON.stringify(config.manifest);

await import(pathToFileURL(resolve(here, 'linkedin-imap-pdf-intake.mjs')).href + `?run=${Date.now()}`);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `expected_pages=${config.expectedPages}\nrevision=${config.revision}\n`, 'utf8');
}

console.log(JSON.stringify({
  ok: true,
  id: config.id,
  revision: config.revision,
  expectedPages: config.expectedPages,
  expectedBytes: config.expectedBytes,
  expectedSha256: config.expectedSha256,
}, null, 2));
