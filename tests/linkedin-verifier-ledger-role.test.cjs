const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { AsyncFunction } = { AsyncFunction: Object.getPrototypeOf(async function () {}).constructor };
const workflowPath = process.env.VERIFIER_WORKFLOW || path.join(__dirname, '../.github/workflows/linkedin-publication-verifier.yml');
const workflow = fs.readFileSync(workflowPath, 'utf8');
const scripts = [...workflow.matchAll(/^          script: \|\n((?:            .*\n|\n)+)/gm)].map(m => m[1].split('\n').map(l => l.startsWith('            ') ? l.slice(12) : l).join('\n'));
assert.equal(scripts.length, 2, 'publication and analytics scripts must both be tested');
const bot = body => ({id:1,user:{login:'github-actions[bot]',id:41898282,type:'Bot'},performed_via_github_app:{id:15368,slug:'github-actions'},body});
const key = 'rs-li-fresha-client-return-system-001@2:secondary';
const intent = bot(`<!-- BUFFER_DISPATCH_INTENT ${key} -->`);
const past = '2026-01-01T07:45:00.000Z';
const accepted = bot(`- Fresha: Buffer post ID \`buffer-1\` | ${past}\n<!-- BUFFER_ACCEPTED ${key} bufferId=buffer-1 dueAt=${past} -->`);
const approval = {number: 637, title: '[APPROVED LINKEDIN] rs-li-fresha-client-return-system-001@2', body: 'MODE: schedule', state: 'open'};
const historicLedger = {number: 607, title: '[FAILED LINKEDIN] Buffer acceptance ledger', body: 'Durable machine ledger', state: 'open'};
const currentLedger = {number: 677, title: '[BUFFER ACCEPTANCE LEDGER] LinkedIn governed releases', user: {login: 'github-actions[bot]'}};

// Exercise the actual production ledger helpers with mocked external I/O.
const helpers = require('../scripts/linkedin-buffer-acceptance-ledger.cjs');
async function run({issues=[historicLedger,approval], comments={607:[intent,accepted],637:[intent,accepted]}, post={id:'buffer-1',status:'sent',sentAt:past,externalLink:'https://www.linkedin.com/feed/update/urn:li:share:test'}, analytics=false, providerError=null, posts=null, captureError=false}={}) {
 let queries=0; const writes=[]; const commentReads=[];
 const github={rest:{issues:{listForRepo:'issues',listComments:'comments',createComment:async v=>writes.push(v),update:async v=>writes.push(v)}},paginate:async (endpoint,args)=>{
  if(endpoint==='issues') return issues;
  commentReads.push(args.issue_number); return comments[args.issue_number]||[];
 }};
 const localRequire=name=>name==='node:path' ? path : helpers;
 const fetch=async (_url,options)=>{queries++; const q=JSON.parse(options.body).query; assert.ok(q.startsWith('query '), 'Buffer access must remain read-only'); const id=q.match(/id: "([^"]+)"/)?.[1]; const selected=posts ? posts[id] : post; const error=providerError || (selected instanceof Error ? selected.message : null); return {ok:true,json:async()=>error ? {errors:[{message:error}]} : {data:{post:selected}}};};
 const execute=new AsyncFunction('require','process','context','github','fetch',scripts[analytics?1:0]);
 let error; try { await execute(localRequire,{env:{BUFFER_API_KEY:'internal-test-only',GITHUB_WORKSPACE:'/test'}},{repo:{owner:'Chelston222',repo:'CGPT-1'}},github,fetch); } catch(e) { if (!captureError) throw e; error=e; }
 return {queries,writes,commentReads,error};
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
 const r=await run({analytics:true,comments:{607:[verified],637:[verified]},post:{status:'sent',sentAt:past,metrics:[{name:'impressions',value:3}],metricsUpdatedAt:past}});assert.deepEqual(r.commentReads,[637]);assert.equal(r.queries,1);assert.equal(r.writes[0].issue_number,637);
});
test('pull requests are not approval records',async()=>{
 const r=await run({issues:[{...approval,pull_request:{url:'test'}}]});assert.equal(r.queries,0);assert.equal(r.writes.length,0);
});


test('unexpected lookup failure remains unresolved and does not starve another post',async()=>{
 const other=bot(`- Other: Buffer post ID \`buffer-2\` | ${past}`);
 const r=await run({issues:[approval],comments:{637:[intent,accepted,other]},posts:{'buffer-1':new Error('Post not found for id: buffer-1'),'buffer-2':{status:'sent',sentAt:past}},captureError:true});
 assert.equal(r.queries,2);assert.match(r.error.message,/verification incomplete/);
 assert.ok(r.writes.some(w=>w.body?.includes('LOOKUP_UNRESOLVED bufferId=buffer-1')));
 assert.ok(r.writes.some(w=>w.body?.includes('PUBLICATION_VERIFIED bufferId=buffer-2')));
 assert.ok(!r.writes.some(w=>w.body?.includes('PUBLICATION_VERIFIED bufferId=buffer-1')));
});
test('exact owner cleanup and trusted success receipt reconcile non-publication without provider lookup',async()=>{
 const cleanup={number:784,title:'[RUN BUFFER CLEANUP] rebuild',user:{login:'Chelston222',id:246655273},author_association:'OWNER',body:'DELETE_POST_IDS: buffer-1'};
 const receipt={...bot('- Deleted Buffer post `buffer-1` (DeletePostSuccess)'),html_url:'https://github.com/Chelston222/CGPT-1/issues/784#issuecomment-1'};
 const r=await run({issues:[approval,cleanup],comments:{637:[intent,accepted],784:[receipt]}});
 assert.equal(r.queries,0);assert.match(r.writes[0].body,/PUBLICATION_SUPERSEDED bufferId=buffer-1/);assert.doesNotMatch(r.writes[0].body,/PUBLICATION_VERIFIED/);
});
test('untrusted cleanup receipt cannot hide a missing post',async()=>{
 const cleanup={number:784,title:'[RUN BUFFER CLEANUP] rebuild',user:{login:'Chelston222',id:246655273},author_association:'OWNER',body:'DELETE_POST_IDS: buffer-1'};
 const receipt={user:{login:'someone'},body:'- Deleted Buffer post `buffer-1` (DeletePostSuccess)',html_url:'https://github.com/x'};
 const r=await run({issues:[approval,cleanup],comments:{637:[intent,accepted],784:[receipt]},providerError:'missing',captureError:true});
 assert.equal(r.queries,1);assert.ok(r.error);assert.ok(!r.writes.some(w=>w.body?.includes('PUBLICATION_SUPERSEDED')));
});
test('null provider post remains unresolved, never silently skipped',async()=>{
 const r=await run({post:null,captureError:true});assert.match(r.error.message,/Buffer returned no post/);assert.match(r.writes[0].body,/LOOKUP_UNRESOLVED/);
});

test('analytics missing post does not block capture for the next verified post',async()=>{
 const v=bot('<!-- LINKEDIN_PUBLICATION_VERIFIED bufferId=buffer-1 -->\n<!-- LINKEDIN_PUBLICATION_VERIFIED bufferId=buffer-2 -->');
 const r=await run({analytics:true,issues:[approval],comments:{637:[v]},posts:{'buffer-1':new Error('missing'),'buffer-2':{status:'sent',sentAt:past,metricsUpdatedAt:past,metrics:[{name:'impressions',value:3}]}},captureError:true});
 assert.equal(r.queries,2);assert.match(r.error.message,/Analytics capture incomplete/);assert.ok(r.writes.some(w=>w.body?.includes('ANALYTICS_CAPTURED bufferId=buffer-2')));
});
test('pre-publication metrics are never declared captured',async()=>{
 const v=bot('<!-- LINKEDIN_PUBLICATION_VERIFIED bufferId=buffer-1 -->');
 const r=await run({analytics:true,issues:[approval],comments:{637:[v]},post:{status:'sent',sentAt:'2026-01-02T00:00:00Z',metricsUpdatedAt:past,metrics:[{name:'impressions',value:0}]}});
 assert.equal(r.writes.length,0);
});

test('stale pre-publication captured marker is refreshed rather than trusted forever',async()=>{
 const v=bot('<!-- LINKEDIN_PUBLICATION_VERIFIED bufferId=buffer-1 sentAt=2026-01-02T00:00:00Z -->\n<!-- LINKEDIN_ANALYTICS_CAPTURED bufferId=buffer-1 metricsUpdatedAt=2026-01-01T00:00:00Z -->');
 const r=await run({analytics:true,issues:[approval],comments:{637:[v]},post:{status:'sent',sentAt:'2026-01-02T00:00:00Z',metricsUpdatedAt:'2026-01-03T00:00:00Z',metrics:[{name:'impressions',value:42}]}});
 assert.equal(r.queries,1);assert.match(r.writes[0].body,/ANALYTICS_CAPTURED/);
});
test('valid post-publication captured marker remains idempotent',async()=>{
 const v=bot('<!-- LINKEDIN_PUBLICATION_VERIFIED bufferId=buffer-1 sentAt=2026-01-02T00:00:00Z -->\n<!-- LINKEDIN_ANALYTICS_CAPTURED bufferId=buffer-1 metricsUpdatedAt=2026-01-03T00:00:00Z -->');
 const r=await run({analytics:true,issues:[approval],comments:{637:[v]}});assert.equal(r.queries,0);assert.equal(r.writes.length,0);
});

test('actual historical receipt set resolves 24 removals without publication or provider mutation',async()=>{
 const f=require('./fixtures/linkedin-historical-removal-receipts.json');
 const ids=f.issues.find(i=>i.number===60).body.split(': ')[1].split(',');
 const legacy={number:56,title:'[APPROVED LINKEDIN WEEK] historical batch',body:'MODE: schedule'};
 const receipt=bot(ids.map((id,n)=>'- Legacy '+n+': Buffer post ID '+String.fromCharCode(96)+id+String.fromCharCode(96)+' | '+past).join('\n'));
 const r=await run({issues:[...f.issues,legacy],comments:{...f.comments,56:[receipt]},providerError:'Post not found',captureError:true});
 assert.equal(r.error,undefined);assert.equal(r.queries,0);assert.equal(r.writes.length,24);
 for(const write of r.writes){assert.match(write.body,/PUBLICATION_SUPERSEDED/);assert.doesNotMatch(write.body,/PUBLICATION_VERIFIED|ANALYTICS_CAPTURED|OWNER_ABANDONED_DRAFT/);}
});
test('historical removals never count as publication or analytics evidence',async()=>{
 const f=require('./fixtures/linkedin-historical-removal-receipts.json');
 const comments={294:[...f.comments[294],bot('<!-- LINKEDIN_PUBLICATION_SUPERSEDED bufferId=6a89fc2ddeb4b57dfea8b628 cleanupIssue=386 -->')]};
 const r=await run({analytics:true,issues:f.issues,comments});assert.equal(r.queries,0);assert.equal(r.writes.length,0);
});
test('old scheduled approval returning provider draft remains unresolved without retirement',async()=>{
 const r=await run({post:{status:'draft',dueAt:past}});
 assert.equal(r.queries,1);assert.match(r.writes[0].body,/PUBLICATION_PENDING/);
 assert.ok(!r.writes.some(w=>/SUPERSEDED|ABANDONED|PUBLICATION_VERIFIED|DRAFT_CANARY_RETIRED/.test(w.body||'')));
 const {validateRequest}=require('../scripts/linkedin-review-core.cjs');
 for(let n=100;n<=104;n++)assert.throws(()=>validateRequest('POST_ID: stale-'+n+'\nTARGETS: personal\nMODE: schedule\nSCHEDULE_AT: '+past+'\n---\nHistorical copy',{BUFFER_API_KEY:'test',BUFFER_LINKEDIN_PERSONAL_CHANNEL_ID:'test'}),/CONTENT_QA: PASS is required/);
});
