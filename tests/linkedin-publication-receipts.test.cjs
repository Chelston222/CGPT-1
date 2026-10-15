const test=require('node:test');
const assert=require('node:assert/strict');
const {parseAcceptanceRows,parseCompletedCleanup}=require('../scripts/linkedin-buffer-acceptance-ledger.cjs');
const bot=body=>({id:1,user:{login:'github-actions[bot]',id:41898282,type:'Bot'},performed_via_github_app:{id:15368,slug:'github-actions'},created_at:'2026-10-01T00:00:00Z',body});
test('both historical and current date separators parse with marker deduplication',()=>{
 for(const sep of ['—','|']){
  const rows=parseAcceptanceRows([bot(`- Test: Buffer post ID \`id1\` ${sep} 2026-10-02T09:00:00Z\n<!-- BUFFER_ACCEPTED test@1:main bufferId=id1 dueAt=2026-10-02T09:00:00Z -->`)]);
  assert.equal(rows.length,1);assert.equal(rows[0].dueAt,'2026-10-02T09:00:00Z');assert.ok(Number.isFinite(rows[0].acceptedAt));
 }
});
test('untrusted receipts are ignored',()=>assert.deepEqual(parseAcceptanceRows([{user:{login:'human'},body:'<!-- BUFFER_ACCEPTED test@1:main bufferId=id1 dueAt=2026-10-02T09:00:00Z -->'}]),[]));
test('conflicting or missing receipt dates remain unknown',()=>{
 const rows=parseAcceptanceRows([bot('<!-- BUFFER_ACCEPTED a@1:main bufferId=id1 dueAt=2026-10-02T09:00:00Z -->'),bot('<!-- BUFFER_ACCEPTED a@1:main bufferId=id1 dueAt=2026-10-03T09:00:00Z -->')]);
 assert.equal(rows[0].dueAt,null);assert.equal(rows[0].scheduleConflict,true);
 assert.equal(parseAcceptanceRows([bot('- Test: Buffer post ID `id2`')])[0].dueAt,null);
});
test('cleanup requires owner, exact ID, success and bot evidence',()=>{
 const issue={number:784,user:{login:'Chelston222',id:246655273},author_association:'OWNER',title:'[RUN BUFFER CLEANUP] rebuild',body:'DELETE_POST_IDS: id1,id2'};
 const receipt={...bot('- Deleted Buffer post `id1` (DeletePostSuccess)\n- Deleted Buffer post `id2` (DeletePostSuccess)'),html_url:'https://github.com/Chelston222/CGPT-1/issues/784#issuecomment-1'};
 assert.deepEqual([...parseCompletedCleanup(issue,[receipt],'Chelston222').keys()],['id1','id2']);
 assert.equal(parseCompletedCleanup({...issue,user:{login:'other'}},[receipt],'Chelston222').size,0);
 assert.equal(parseCompletedCleanup(issue,[{...receipt,html_url:null}],'Chelston222').size,0);
});

test('conflicting publication timestamps invalidate analytics in either comment order',()=>{
 const {validAnalyticsCaptureIds}=require('../scripts/linkedin-buffer-acceptance-ledger.cjs');
 const early=bot('<!-- LINKEDIN_PUBLICATION_VERIFIED bufferId=x sentAt=2026-01-01T00:00:00Z -->');
 const late=bot('<!-- LINKEDIN_PUBLICATION_VERIFIED bufferId=x sentAt=2026-01-03T00:00:00Z -->');
 const captured=bot('<!-- LINKEDIN_ANALYTICS_CAPTURED bufferId=x metricsUpdatedAt=2026-01-02T00:00:00Z -->');
 for (const comments of [[early,late,captured],[late,early,captured]]) assert.equal(validAnalyticsCaptureIds(comments).size,0);
});
