const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { AsyncFunction } = { AsyncFunction: Object.getPrototypeOf(async function () {}).constructor };
const workflowPath = process.env.VERIFIER_WORKFLOW || path.join(__dirname, '../.github/workflows/linkedin-publication-verifier.yml');
const workflow = fs.readFileSync(workflowPath, 'utf8');
const scripts = [...workflow.matchAll(/^          script: \|\n((?:            .*\n|\n)+)/gm)].map(m => m[1].split('\n').map(l => l.startsWith('            ') ? l.slice(12) : l).join('\n'));
assert.equal(scripts.length, 2, 'publication and analytics scripts must both be tested');
const bot = body => ({user: {login: 'github-actions[bot]'}, body});
const key = 'rs-li-fresha-client-return-system-001@2:secondary';
const intent = bot(`<!-- BUFFER_DISPATCH_INTENT ${key} -->`);
const past = '2026-01-01T07:45:00.000Z';
const accepted = bot(`- Fresha: Buffer post ID \`buffer-1\` | ${past}\n<!-- BUFFER_ACCEPTED ${key} bufferId=buffer-1 dueAt=${past} -->`);
const approval = {number: 637, title: '[APPROVED LINKEDIN] rs-li-fresha-client-return-system-001@2', body: 'MODE: schedule', state: 'open'};
const historicLedger = {number: 607, title: '[FAILED LINKEDIN] Buffer acceptance ledger', body: 'Durable machine ledger', state: 'open'};
const currentLedger = {number: 677, title: '[BUFFER ACCEPTANCE LEDGER] LinkedIn governed releases', user: {login: 'github-actions[bot]'}};

// Test doubles reproduce the helper's documented marker contract. The unchanged
// production helper remains covered by its own repository tests.
const helpers = {
 parseIntentKeys: comments => new Set(comments.filter(c=>c.user?.login==='github-actions[bot]').flatMap(c=>[...c.body.matchAll(/<!--\s*BUFFER_DISPATCH_INTENT\s+([^\s>]+)\s*-->/g)].map(m=>m[1]))),
 parseAcceptanceEntries: comments => new Map(comments.filter(c=>c.user?.login==='github-actions[bot]').flatMap(c=>[...c.body.matchAll(/<!--\s*BUFFER_ACCEPTED\s+([^\s]+)\s+bufferId=([^\s>]+)(?:\s+dueAt=([^\s>]+))?\s*-->/g)].map(m=>[m[1],{bufferId:m[2],dueAt:m[3]}]))),
 selectTrustedLedgerIssue: issues => {
   const ledgers=issues.filter(i=>i.title===currentLedger.title && ['github-actions[bot]','Chelston222'].includes(i.user?.login));
   if(ledgers.length>1) throw new Error('split-brain ledger');
   return ledgers[0] || null;
 }
};
async function run({issues=[historicLedger,approval], comments={607:[intent,accepted],637:[intent,accepted]}, post={id:'buffer-1',status:'sent',sentAt:past,externalLink:'https://www.linkedin.com/feed/update/urn:li:share:test'}, analytics=false}={}) {
 let queries=0; const writes=[]; const commentReads=[];
 const github={rest:{issues:{listForRepo:'issues',listComments:'comments',createComment:async v=>writes.push(v),update:async v=>writes.push(v)}},paginate:async (endpoint,args)=>{
  if(endpoint==='issues') return issues;
  commentReads.push(args.issue_number); return comments[args.issue_number]||[];
 }};
 const localRequire=name=>name==='node:path' ? path : helpers;
 const fetch=async (_url,options)=>{queries++; assert.ok(JSON.parse(options.body).query.startsWith('query '), 'Buffer access must remain read-only');return {ok:true,json:async()=>({data:{post}})}};
 const execute=new AsyncFunction('require','process','context','github','fetch',scripts[analytics?1:0]);
 await execute(localRequire,{env:{BUFFER_API_KEY:'internal-test-only',GITHUB_WORKSPACE:'/test'}},{repo:{owner:'Chelston222',repo:'CGPT-1'}},github,fetch);
 return {queries,writes,commentReads};
}
test('historical ledger mirror does not duplicate a real approval',async()=>{
 const r=await run(); assert.equal(r.queries,1);assert.deepEqual(r.commentReads,[637]);assert.equal(r.writes.length,1);assert.equal(r.writes[0].issue_number,637);assert.match(r.writes[0].body,/LINKEDIN_PUBLICATION_VERIFIED/);
});
test('genuine duplicate approvals remain fail-closed',async()=>{
 await assert.rejects(run({issues:[approval,{...approval,number:638}],comments:{637:[intent,accepted],638:[intent,accepted]}}),/appears on more than one governed approval issue/);
});
test('current trusted ledger fallback remains active',async()=>{
 const r=await run({issues:[historicLedger,approval,currentLedger],comments:{607:[intent,accepted],637:[intent],677:[intent,accepted]}});assert.equal(r.queries,1);assert.match(r.writes[0].body,/durable_ledger_fallback/);
});
test('ledger-only evidence cannot authorise a publication result',async()=>{
 const r=await run({issues:[historicLedger,currentLedger],comments:{607:[intent,accepted],677:[intent,accepted]}});assert.equal(r.queries,0);assert.equal(r.writes.length,0);
});
test('future approved post is not prematurely verified',async()=>{
 const future=new Date(Date.now()+86400000).toISOString();const a=bot(`- Fresha: Buffer post ID \`buffer-1\` | ${future}`);const r=await run({issues:[approval],comments:{637:[intent,a]}});assert.equal(r.queries,0);assert.equal(r.writes.length,0);
});
test('sent without sentAt is not publication proof',async()=>{
 const r=await run({post:{status:'sent'}});assert.ok(!r.writes.some(w=>w.body?.includes('LINKEDIN_PUBLICATION_VERIFIED')));
});
test('provider error is failure rather than published',async()=>{
 const r=await run({post:{status:'error',error:{message:'test failure'}}});assert.match(r.writes[0].body,/LINKEDIN_PUBLICATION_FAILED/);assert.doesNotMatch(r.writes[0].body,/LINKEDIN_PUBLICATION_VERIFIED/);
});
test('draft canary stays distinct from publication',async()=>{
 const r=await run({issues:[{...approval,body:'MODE: draft'}],post:{status:'draft'}});assert.match(r.writes[0].body,/LINKEDIN_DRAFT_CANARY_VERIFIED/);assert.doesNotMatch(r.writes[0].body,/LINKEDIN_PUBLICATION_VERIFIED/);
});
test('already verified result does not create another event',async()=>{
 const r=await run({issues:[approval],comments:{637:[intent,accepted,bot('<!-- LINKEDIN_PUBLICATION_VERIFIED bufferId=buffer-1 -->')]}});assert.equal(r.queries,0);assert.equal(r.writes.length,0);
});
test('untrusted human acceptance comments are not trusted',async()=>{
 const r=await run({issues:[approval],comments:{637:[{...accepted,user:{login:'untrusted'}}]}});assert.equal(r.queries,0);assert.equal(r.writes.length,0);
});
test('analytics also excludes the historical ledger mirror',async()=>{
 const verified=bot('<!-- LINKEDIN_PUBLICATION_VERIFIED bufferId=buffer-1 -->');
 const r=await run({analytics:true,comments:{607:[verified],637:[verified]},post:{status:'sent',metrics:[{name:'impressions',value:3}],metricsUpdatedAt:past}});assert.deepEqual(r.commentReads,[637]);assert.equal(r.queries,1);assert.equal(r.writes[0].issue_number,637);
});
test('pull requests are not approval records',async()=>{
 const r=await run({issues:[{...approval,pull_request:{url:'test'}}]});assert.equal(r.queries,0);assert.equal(r.writes.length,0);
});
