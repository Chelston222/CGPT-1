#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function arg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const inputPath = arg('--input');
if (!inputPath) throw new Error('Use --input with a JSON file containing id, title and content.');
const ledgerPath = resolve(arg('--ledger', '../work/master-linkedin-ledger.json'));
const manifestPath = resolve(arg('--manifest', 'apps/linkedin-review/ledger-manifest.json'));
const input = JSON.parse(await readFile(resolve(inputPath), 'utf8'));
const ledger = JSON.parse(await readFile(ledgerPath, 'utf8'));
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const normalise = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const hash = (value) => createHash('sha256').update(value).digest('hex');

const id = String(input.id || '').trim();
const title = String(input.title || '').trim();
const content = String(input.content || '').trim();
if (!/^[a-z0-9][a-z0-9-]{2,80}$/i.test(id)) throw new Error('id must be a stable 3–81 character slug.');
if (!title || !content) throw new Error('title and content are required.');
if (content.length > 3000) throw new Error('content exceeds LinkedIn’s 3,000-character post limit.');
if (ledger.records.some((record) => record.id === id)) throw new Error(`Master Ledger already contains id ${id}. Create a new revision instead of overwriting it.`);

const contentHash = hash(normalise(content));
if (ledger.records.some((record) => record.contentHash === contentHash)) throw new Error('This copy already exists in the Master Ledger.');
const now = new Date().toISOString();
ledger.records.push({
  id, title, content, contentHash,
  recordType: 'editorial_candidate',
  category: input.category || 'uncategorised',
  source: { type: 'master_intake', reference: input.source || 'direct_intake', importedAt: now },
  qa: { status: 'awaiting_qa', publishable: false },
  state: 'draft',
  history: [{ state: 'draft', at: now, reason: 'Added to Master LinkedIn Ledger before QA or scheduling.' }],
});
ledger.generatedAt = now;
ledger.summary.uniqueMasterRecords = ledger.records.length;
ledger.summary.masterIntake = (ledger.summary.masterIntake || 0) + 1;

manifest.generatedAt = now;
manifest.ledgerHash = hash(JSON.stringify(ledger.records));
manifest.summary = ledger.summary;
const ledgerTemp = `${ledgerPath}.tmp`;
const manifestTemp = `${manifestPath}.tmp`;
await writeFile(ledgerTemp, `${JSON.stringify(ledger, null, 2)}\n`);
await writeFile(manifestTemp, `${JSON.stringify(manifest, null, 2)}\n`);
await rename(ledgerTemp, ledgerPath);
await rename(manifestTemp, manifestPath);
console.log(JSON.stringify({ added: id, contentHash, total: ledger.records.length, state: 'draft', publishable: false }, null, 2));
