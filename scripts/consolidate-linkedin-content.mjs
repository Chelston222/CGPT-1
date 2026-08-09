#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.csv', '.json']);
const SKIP_PARTS = new Set(['.git', 'node_modules', '.venv', '__pycache__', 'codex_portable_archive']);
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const args = process.argv.slice(2);
const outputFlag = args.indexOf('--output');
const outputPath = resolve(outputFlag >= 0 ? args[outputFlag + 1] : '.local-linkedin-content-library.json');
const inputs = args.filter((_, index) => index !== outputFlag && index !== outputFlag + 1);

if (!inputs.length) {
  console.error('Usage: node scripts/consolidate-linkedin-content.mjs <file-or-folder> [...] --output <private-output.json>');
  process.exit(1);
}

async function collectFiles(input, files = []) {
  const path = resolve(input);
  const details = await stat(path);
  if (details.isFile()) {
    if (TEXT_EXTENSIONS.has(extname(path).toLowerCase()) && details.size <= MAX_FILE_SIZE) files.push(path);
    return files;
  }
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (SKIP_PARTS.has(entry.name) || entry.name.startsWith('.')) continue;
    await collectFiles(join(path, entry.name), files);
  }
  return files;
}

function clean(text) {
  return String(text)
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitMarkdown(text) {
  const lines = text.split('\n');
  const chunks = [];
  let current = [];
  for (const line of lines) {
    if (/^#{1,4}\s+/.test(line) && current.length) {
      chunks.push(current.join('\n'));
      current = [];
    }
    current.push(line);
  }
  if (current.length) chunks.push(current.join('\n'));
  return chunks;
}

function splitText(text) {
  return text.split(/\n\s*\n(?=\S)/);
}

function splitCsv(text) {
  const lines = text.split('\n').filter(Boolean);
  if (lines.length < 2) return lines;
  const header = lines[0];
  return lines.slice(1).map((line) => `${header}\n${line}`);
}

function collectJsonStrings(value, path = '$', records = []) {
  if (typeof value === 'string' && value.trim().length >= 80) records.push(`${path}\n${value}`);
  else if (Array.isArray(value)) value.forEach((item, index) => collectJsonStrings(item, `${path}[${index}]`, records));
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) collectJsonStrings(item, `${path}.${key}`, records);
  }
  return records;
}

function contentChunks(text, extension) {
  if (extension === '.md') return splitMarkdown(text);
  if (extension === '.csv') return splitCsv(text);
  if (extension === '.json') {
    try { return collectJsonStrings(JSON.parse(text)); } catch { return splitText(text); }
  }
  return splitText(text);
}

function hashContent(value) {
  return createHash('sha256').update(value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()).digest('hex');
}

const files = [];
for (const input of inputs) await collectFiles(input, files);

const seen = new Map();
const records = [];
let rawChunks = 0;

for (const path of [...new Set(files)].sort()) {
  const extension = extname(path).toLowerCase();
  const text = await readFile(path, 'utf8').catch(() => '');
  for (const raw of contentChunks(text, extension)) {
    const content = clean(raw);
    if (content.length < 80 || content.length > 15000) continue;
    rawChunks += 1;
    const hash = hashContent(content);
    if (seen.has(hash)) {
      seen.get(hash).duplicateSources.push(path);
      continue;
    }
    const titleLine = content.split('\n').find((line) => line.trim()) || 'Untitled';
    const record = {
      id: `archive-${hash.slice(0, 12)}`,
      title: titleLine.replace(/^#{1,4}\s+/, '').slice(0, 140),
      sourcePath: path,
      duplicateSources: [],
      contentHash: hash,
      characters: content.length,
      content,
    };
    seen.set(hash, record);
    records.push(record);
  }
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  privacy: 'Local working index. Review before publishing or committing; source paths may be private.',
  inputRoots: inputs.map((input) => resolve(input)),
  summary: {
    filesScanned: [...new Set(files)].length,
    rawContentChunks: rawChunks,
    exactDuplicatesRemoved: rawChunks - records.length,
    uniqueRecords: records.length,
  },
  records,
};

await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, ...report.summary }, null, 2));
