'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.HEALTH_ROOT || path.resolve(__dirname, '..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/linkedin-content-os-green-gate.yml'), 'utf8');
const scripts = [...workflow.matchAll(/^          script: \|\n((?:            .*\n|\n)+)/gm)];
assert.equal(scripts.length, 1, 'execute the actual health workflow script');
const source = scripts[0][1].split('\n').map(line => line.startsWith('            ') ? line.slice(12) : line).join('\n');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const owner = 'Chelston222';
const bot = body => ({ user: { login: 'github-actions[bot]' }, body, created_at: '2026-09-01T00:00:00Z' });
const past = '2026-09-02T09:00:00Z';
const approval = { number: 782, title: '[APPROVED LINKEDIN] real approval', user: { login: owner }, state: 'closed' };
const mirror = { number: 607, title: '[FAILED LINKEDIN] Buffer acceptance ledger', user: { login: owner }, state: 'open' };
const receipt = dueAt => bot(`<!-- BUFFER_ACCEPTED post@1:main bufferId=post-1${dueAt ? ` dueAt=${dueAt}` : ''} -->`);
const terminal = kind => bot(`<!-- ${kind} bufferId=post-1 -->`);

async function run({ comments = [receipt(past)], includeMirror = false } = {}) {
  let body = '';
  let failure = null;
  const reads = [];
  const writes = [];
  const issues = includeMirror ? [approval, mirror] : [approval];
  const recordWrite = async args => { writes.push(args); if (args.body) body = args.body; };
  const github = {
    rest: { issues: { listForRepo: 'issues', listComments: 'comments', create: recordWrite, createComment: recordWrite, update: recordWrite } },
    paginate: async (endpoint, args) => {
      if (endpoint === 'comments') {
        reads.push(args.issue_number);
        return args.issue_number === approval.number ? comments : [receipt(past)];
      }
      return args.state === 'all' ? issues : [];
    },
  };
  const fetch = async (_url, options) => {
    const query = JSON.parse(options.body).query;
    assert.ok(query.startsWith('query '), 'health must never mutate the provider');
    let data;
    if (query.includes('channel(input')) {
      const id = query.match(/id: "([^"]+)"/)[1];
      const days = id === 'personal' ? ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] : ['mon', 'tue', 'wed', 'thu', 'fri'];
      data = { channel: { id, name: id === 'secondary' ? 'Retention School' : id, timezone: 'Europe/London', postingSchedule: days.map(day => ({ day, times: ['09:00'], paused: false })) } };
    } else if (query.includes('account {')) {
      data = { account: { organizations: [{ id: 'org' }] } };
    } else {
      data = { posts: {
        edges: ['personal', 'main', 'secondary'].map(id => ({ node: { id: `scheduled-${id}`, channelId: id, dueAt: '2099-01-01T09:00:00Z', status: 'scheduled', isCustomScheduled: true, shareMode: 'customScheduled' } })),
        pageInfo: { hasNextPage: false },
      } };
    }
    return { ok: true, json: async () => ({ data }), headers: {} };
  };
  const summary = { addHeading() { return this; }, addRaw(value) { body = value; return this; }, write() { return this; } };
  const core = { summary, setFailed: message => { failure = message; } };
  const localRequire = name => name.startsWith('node:') ? require(name) : require(path.join(root, 'scripts/linkedin-buffer-acceptance-ledger.cjs'));
  await new AsyncFunction('require', 'process', 'context', 'github', 'fetch', 'core', source)(
    localRequire,
    { env: { BUFFER_API_KEY: 'mock-only', BUFFER_LINKEDIN_PERSONAL_CHANNEL_ID: 'personal', BUFFER_LINKEDIN_BUSINESS_CHANNEL_ID: 'main', BUFFER_LINKEDIN_SECONDARY_CHANNEL_ID: 'secondary', GITHUB_WORKSPACE: root } },
    { repo: { owner, repo: 'CGPT-1' }, eventName: 'schedule' },
    github, fetch, core,
  );
  const backlog = Number(body.match(/Publication verification backlog: \*\*(\d+)/)?.[1]);
  assert.ok(Number.isInteger(backlog), 'health report must expose a publication backlog');
  return { body, failure, backlog, reads, writes };
}

test('health fails closed for marker-only overdue acceptance', async () => {
  const result = await run();
  assert.equal(result.backlog, 1);
  assert.ok(result.failure);
});

test('health fails closed for absent, invalid and conflicting receipt dates', async () => {
  for (const comments of [[receipt(null)], [receipt('invalid-date')], [receipt(past), receipt('2099-01-01T09:00:00Z')]]) {
    const result = await run({ comments });
    assert.equal(result.backlog, 1);
    assert.ok(result.failure);
  }
});

test('health fails closed for missing acceptance timestamp even with a future due time', async () => {
  const comment = receipt('2099-01-01T09:00:00Z');
  delete comment.created_at;
  const result = await run({ comments: [comment] });
  assert.equal(result.backlog, 1);
  assert.ok(result.failure);
});

test('health does not mistake valid future acceptance for overdue publication', async () => {
  const result = await run({ comments: [receipt('2099-01-01T09:00:00Z')] });
  assert.equal(result.backlog, 0);
  assert.equal(result.failure, null);
});

test('health deduplicates legacy and machine receipts for the same placement', async () => {
  const result = await run({ comments: [receipt(past), bot(`- Test: Buffer post ID \`post-1\` | ${past}`)] });
  assert.equal(result.backlog, 1);
});

test('trusted non-publication and retired-draft terminals resolve backlog without publication claims', async () => {
  for (const kind of ['LINKEDIN_PUBLICATION_SUPERSEDED', 'LINKEDIN_DRAFT_CANARY_RETIRED', 'LINKEDIN_OWNER_ABANDONED_DRAFT', 'LINKEDIN_DRAFT_CANARY_VERIFIED']) {
    const result = await run({ comments: [receipt(null), terminal(kind)] });
    assert.equal(result.backlog, 0);
    assert.equal(result.failure, null);
    assert.ok(result.writes.every(write => !write.body?.includes('LINKEDIN_PUBLICATION_VERIFIED')));
  }
});

test('untrusted terminal comments cannot clear trusted publication debt', async () => {
  const forged = { ...terminal('LINKEDIN_PUBLICATION_SUPERSEDED'), user: { login: 'untrusted' } };
  const result = await run({ comments: [receipt(past), forged] });
  assert.equal(result.backlog, 1);
  assert.ok(result.failure);
});

test('explicit publication failure remains red even though it is terminal', async () => {
  const result = await run({ comments: [receipt(past), terminal('LINKEDIN_PUBLICATION_FAILED')] });
  assert.equal(result.backlog, 0);
  assert.ok(result.failure);
  assert.match(result.body, /Publication failures: \*\*1\*\*/);
});

test('verified publication still needs analytics evidence before health is green', async () => {
  const comments = [receipt(past), bot(`<!-- LINKEDIN_PUBLICATION_VERIFIED bufferId=post-1 sentAt=${past} -->`)];
  const pending = await run({ comments });
  assert.equal(pending.backlog, 0);
  assert.ok(pending.failure);
  assert.match(pending.body, /Current Buffer analytics backlog: \*\*1\*\*/);
  const captured = await run({ comments: [...comments, bot(`<!-- LINKEDIN_ANALYTICS_CAPTURED bufferId=post-1 metricsUpdatedAt=${past} -->`)] });
  assert.equal(captured.failure, null);
});

test('stale, undated, invalid and untrusted analytics markers cannot make health green', async () => {
  const publication = bot(`<!-- LINKEDIN_PUBLICATION_VERIFIED bufferId=post-1 sentAt=${past} -->`);
  const captured = timestamp => bot(`<!-- LINKEDIN_ANALYTICS_CAPTURED bufferId=post-1 metricsUpdatedAt=${timestamp} -->`);
  for (const marker of [captured('2026-09-01T00:00:00Z'), terminal('LINKEDIN_ANALYTICS_CAPTURED'), captured('invalid-date'), { ...captured(past), user: { login: 'untrusted' } }]) {
    const result = await run({ comments: [receipt(past), publication, marker] });
    assert.equal(result.backlog, 0);
    assert.ok(result.failure);
    assert.match(result.body, /Current Buffer analytics backlog: \*\*1\*\*/);
  }
});

test('conflicting publication timestamps cannot make analytics current in either comment order', async () => {
  const early = bot('<!-- LINKEDIN_PUBLICATION_VERIFIED bufferId=post-1 sentAt=2026-09-02T00:00:00Z -->');
  const late = bot('<!-- LINKEDIN_PUBLICATION_VERIFIED bufferId=post-1 sentAt=2026-09-04T00:00:00Z -->');
  const captured = bot('<!-- LINKEDIN_ANALYTICS_CAPTURED bufferId=post-1 metricsUpdatedAt=2026-09-03T00:00:00Z -->');
  for (const publications of [[early, late], [late, early]]) {
    const result = await run({ comments: [receipt(past), ...publications, captured] });
    assert.ok(result.failure);
    assert.match(result.body, /Current Buffer analytics backlog: \*\*1\*\*/);
  }
});

test('historical acceptance mirror is not a second unresolved approval', async () => {
  const result = await run({ comments: [receipt(past), terminal('LINKEDIN_PUBLICATION_SUPERSEDED')], includeMirror: true });
  assert.equal(result.backlog, 0);
  assert.equal(result.failure, null);
  assert.deepEqual(result.reads, [approval.number]);
});
