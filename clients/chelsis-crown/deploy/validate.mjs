import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), '..');
const required = [
  'README.md',
  'config/brand.json',
  'config/properties.json',
  'config/lists-and-segments.json',
  'flows/catalog.json',
  'templates/base.html',
  'templates/copy-bank.md',
  'qa/acceptance.md'
];

let failed = false;
for (const rel of required) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    console.error(`MISSING ${rel}`);
    failed = true;
  }
}

const textFiles = required.filter(f => !f.endsWith('.json'));
const forbiddenPatterns = [
  /Klaviyo-API-Key\s+[A-Za-z0-9_-]{8,}/i,
  /pk_[A-Za-z0-9_-]{8,}/i,
  /sk_[A-Za-z0-9_-]{8,}/i,
  /PRIVATE[_ -]?API[_ -]?KEY\s*[:=]\s*['\"][^'\"]+/i
];

for (const rel of textFiles) {
  const body = fs.readFileSync(path.join(root, rel), 'utf8');
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(body)) {
      console.error(`POSSIBLE SECRET in ${rel}`);
      failed = true;
    }
  }
}

const flows = JSON.parse(fs.readFileSync(path.join(root, 'flows/catalog.json'), 'utf8'));
for (const flow of flows.flows) {
  if (!flow.id || !flow.name || !flow.trigger || !Array.isArray(flow.messages) || !Array.isArray(flow.exit_conditions)) {
    console.error(`INVALID FLOW ${flow.id ?? '(unknown)'}`);
    failed = true;
  }
}

const template = fs.readFileSync(path.join(root, 'templates/base.html'), 'utf8');
for (const mustContain of ['unsubscribe', "first_name|default", 'MESSAGE_BODY']) {
  if (!template.includes(mustContain)) {
    console.error(`TEMPLATE MISSING ${mustContain}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('PASS: Chelsi\'s Crown package structural validation complete.');
