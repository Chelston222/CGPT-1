import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map(v => v.replace(/^--/, '').split('=')));
const mode = args.mode || 'dry-run';
if (!['dry-run','draft'].includes(mode)) throw new Error('Mode must be dry-run or draft');

const root = path.resolve(process.cwd(), '..');
const revision = process.env.KLAVIYO_REVISION || '2026-07-15';
const apiKey = process.env.KLAVIYO_CHELSIS_CROWN_PRIVATE_KEY;
const base = 'https://a.klaviyo.com/api';

const cfg = JSON.parse(fs.readFileSync(path.join(root,'config/lists-and-segments.json'),'utf8'));
const flows = JSON.parse(fs.readFileSync(path.join(root,'flows/catalog.json'),'utf8'));
const html = fs.readFileSync(path.join(root,'templates/base.html'),'utf8');

const plan = {
  mode,
  revision,
  resources: {
    lists: cfg.lists.map(x => x.name),
    segments: cfg.segments.map(x => x.name),
    templates: ['CC - Base Editorial Template'],
    flows: flows.flows.map(x => `${x.id} ${x.name}`)
  },
  protections: [
    'No live flow activation',
    'No profile import',
    'No campaign send',
    'No consent inference',
    'No destructive deletion'
  ]
};

console.log(JSON.stringify(plan,null,2));
if (mode === 'dry-run') process.exit(0);
if (!apiKey) throw new Error('Missing KLAVIYO_CHELSIS_CROWN_PRIVATE_KEY secret');

async function request(endpoint, method='GET', body) {
  const res = await fetch(`${base}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Klaviyo-API-Key ${apiKey}`,
      'accept': 'application/vnd.api+json',
      'content-type': 'application/vnd.api+json',
      'revision': revision
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${endpoint} ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

// Safe draft phase deliberately creates only deterministic account resources.
// Existing-resource reconciliation must be added before running repeatedly in production.
for (const list of cfg.lists) {
  await request('/lists','POST',{data:{type:'list',attributes:{name:list.name}}});
  console.log(`CREATED LIST: ${list.name}`);
}

await request('/templates','POST',{
  data:{
    type:'template',
    attributes:{
      name:'CC - Base Editorial Template',
      editor_type:'CODE',
      html
    }
  }
});
console.log('CREATED TEMPLATE: CC - Base Editorial Template');

console.log('SEGMENTS: definitions staged but intentionally not auto-created until each condition is translated to account-valid Klaviyo JSON and tested against real account properties.');
console.log('FLOWS: catalogue staged but intentionally not auto-created from invented JSON. Klaviyo recommends deriving Create Flow definitions from a real account flow definition. Once the client account exists, seed flows are created in Draft, fetched, normalised, then programmatically cloned.');
console.log('DRAFT PHASE COMPLETE. NOTHING ACTIVATED.');
