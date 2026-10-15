'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseCompletedCleanup, parseCompletedRepurpose, pinnedManifest } = require('../scripts/linkedin-buffer-removal-receipts.cjs');
const fixture = require('./fixtures/linkedin-historical-removal-receipts.json');
const clone = () => structuredClone(fixture);
function options(f) { return { approvalIssues:f.issues, commentsByIssue:new Map(Object.entries(f.comments).map(([n,c])=>[Number(n),c])) }; }
function cleanup(f=fixture) { return parseCompletedCleanup(f.issues.find(i=>i.number===60), f.comments[60], 'Chelston222'); }
function repurpose(f=fixture, extra={}) { return parseCompletedRepurpose(f.issues.find(i=>i.number===386), f.comments[386], 'Chelston222', {...options(f),...extra}); }
test('legacy #60 authenticates all 22 exact historical removals', () => {
 const result=cleanup(); assert.equal(result.size,22);
 assert.deepEqual([...result.keys()].sort(),fixture.issues[0].body.split(': ')[1].split(',').sort());
 for(const evidence of result.values()) assert.equal(evidence.evidenceUrl,'https://github.com/Chelston222/CGPT-1/issues/60#issuecomment-5252125825');
});
test('REPURPOSE #386 binds two IDs to pinned manifest, original creative and both execution markers', () => {
 assert.deepEqual([...repurpose().keys()].sort(), ['6a89fc2ddeb4b57dfea8b628','6a89fadfdeb4b57dfea8a80c'].sort());
 for(const evidence of repurpose().values()) { assert.equal(evidence.kind,'repurpose');assert.equal(evidence.manifestBlobSha,'9bb89ddf0d8a392f03a4f8c97c5cead8d8faeb1c'); }
});
for(const [label,mutate] of [
 ['owner login',i=>i.user.login='someone'],
 ['owner numeric ID',i=>i.user.id=1],
 ['OWNER association',i=>i.author_association='CONTRIBUTOR'],
 ['pull request',i=>i.pull_request={}],
]) test('removal approval rejects wrong '+label,()=>{
 for(const number of [60,386]) { const f=clone();mutate(f.issues.find(i=>i.number===number));assert.equal((number===60?cleanup(f):repurpose(f)).size,0); }
});
for(const [label,mutate] of [
 ['login',c=>c.user.login='someone'],
 ['numeric ID',c=>c.user.id=1],
 ['user type',c=>c.user.type='User'],
 ['app ID',c=>c.performed_via_github_app.id=1],
 ['app slug',c=>c.performed_via_github_app.slug='other'],
 ['missing app',c=>c.performed_via_github_app=null],
 ['receipt URL',c=>c.html_url='https://github.com/elsewhere'],
]) test('removal execution rejects wrong '+label,()=>{
 const f=clone();mutate(f.comments[60][0]);assert.equal(cleanup(f).size,0);
 const g=clone();g.comments[386].forEach(mutate);assert.equal(repurpose(g).size,0);
});
for(const [label,mutate] of [
 ['count mismatch',c=>c.body=c.body.replace('**22**','**21**')],
 ['duplicate ID',c=>c.body += '\n- '+String.fromCharCode(96)+'6a7afc5f36b53bf4b42ce9fa'+String.fromCharCode(96)],
 ['extra ID',c=>c.body += '\n- '+String.fromCharCode(96)+'unknown-id'+String.fromCharCode(96)],
 ['missing ID',c=>c.body=c.body.split('\n').filter(l=>!l.includes('- '+String.fromCharCode(96)+'6a7afc5f36b53bf4b42ce9fa')).join('\n')],
 ['success absent',c=>c.body=c.body.replace('✅ Buffer priority cleanup complete.','Intent only')],
 ['malformed ID',c=>c.body += '\n- malformed'],
]) test('legacy cleanup rejects '+label,()=>{const f=clone();mutate(f.comments[60][0]);assert.equal(cleanup(f).size,0);});
test('cleanup rejects duplicate approval IDs or headers',()=>{
 for(const suffix of [',6a7afc5f36b53bf4b42ce9fa','\nDELETE_POST_IDS: extra']){
  const f=clone();f.issues[0].body+=suffix;assert.equal(cleanup(f).size,0);
 }
});
test('current DeletePostSuccess receipts retain exact owner and full ID-list matching',()=>{
 const f=clone();const i=f.issues[0];i.title='[RUN BUFFER CLEANUP] explicit IDs';const ids=i.body.split(': ')[1].split(',');
 f.comments[60][0].body=ids.map(id=>'- Deleted Buffer post '+String.fromCharCode(96)+id+String.fromCharCode(96)+' (DeletePostSuccess)').join('\n');
 assert.equal(cleanup(f).size,22);
 for(const change of [
  c=>c.body += '\n- Deleted Buffer post '+String.fromCharCode(96)+'extra'+String.fromCharCode(96)+' (DeletePostSuccess)',
  c=>c.body=c.body.replace('DeletePostSuccess','MutationError'),
  c=>c.body += '\n'+c.body.split('\n')[0],
 ]) {const bad=structuredClone(f);change(bad.comments[60][0]);assert.equal(cleanup(bad).size,0);}
});
test('pinned manifest bytes must retain the exact approved Git blob',()=>{
 const bytes=fs.readFileSync(path.join(__dirname,'../apps/linkedin-review/buffer-migration-2026-08-23.json'));
 assert.equal(pinnedManifest(bytes).placements.length,26);
 assert.throws(()=>repurpose(fixture,{manifestBytes:Buffer.concat([bytes,Buffer.from('\n')])}),/differs from the owner-approved blob/);
});
for(const [label,mutate] of [
 ['manifest header',i=>i.body=i.body.replace('9bb89ddf0d8a392f03a4f8c97c5cead8d8faeb1c','wrong')],
 ['APPLY missing',i=>i.body=i.body.replace('APPLY: YES','APPLY: NO')],
 ['migration ID',i=>i.body=i.body.replace('buffer-migration-2026-08-23','different')],
 ['snapshot',i=>i.body=i.body.replace('SOURCE_SNAPSHOT_ISSUE: 381','SOURCE_SNAPSHOT_ISSUE: 380')],
 ['duplicate header',i=>i.body+='\nAPPLY: YES'],
]) test('migration rejects approval '+label,()=>{const f=clone();mutate(f.issues.find(i=>i.number===386));assert.equal(repurpose(f).size,0);});
for(const [label,mutate] of [
 ['intent only',f=>f.comments[386]=f.comments[386].filter(c=>c.body.includes('MIGRATION_INTENT'))],
 ['applied only',f=>f.comments[386]=f.comments[386].filter(c=>c.body.includes('MIGRATION_APPLIED'))],
 ['wrong Buffer ID',f=>f.comments[386].forEach(c=>c.body=c.body.replace(/bufferId=\w+/g,'bufferId=unknown'))],
 ['ID mismatch',f=>f.comments[386].filter(c=>c.body.includes('MIGRATION_APPLIED')).forEach(c=>c.body=c.body.replace(/bufferId=\w+/g,'bufferId=unknown'))],
 ['revision mismatch',f=>f.comments[386].forEach(c=>c.body=c.body.replace(/@1:/g,'@2:'))],
 ['target mismatch',f=>f.comments[386].forEach(c=>c.body=c.body.replace(/:main/g,':personal').replace(/:secondary/g,':personal'))],
 ['MOVE',f=>f.comments[386].forEach(c=>c.body=c.body.replace(/action=REPURPOSE/g,'action=MOVE'))],
 ['KEEP',f=>f.comments[386].forEach(c=>c.body=c.body.replace(/action=REPURPOSE/g,'action=KEEP'))],
 ['creative mismatch',f=>f.comments[386].forEach(c=>c.body=c.body.replace(/key=tte-/g,'key=other-'))],
 ['duplicate marker',f=>f.comments[386].forEach(c=>c.body+='\n'+c.body.split('\n').find(l=>l.includes('<!--')))],
 ['duplicate field',f=>f.comments[386].forEach(c=>c.body=c.body.replace(' -->',' action=REPURPOSE -->'))],
]) test('migration rejects '+label,()=>{const f=clone();mutate(f);assert.equal(repurpose(f).size,0);});
test('recovery and original markers must match',()=>{const f=clone();f.comments[386][3].body=f.comments[386][3].body.replace(' recovery=1','');assert.deepEqual([...repurpose(f).keys()],['6a89fc2ddeb4b57dfea8b628']);});
for(const [label,mutate] of [
 ['original owner',i=>i.user.id=1],
 ['creative',i=>i.body=i.body.replace(/POST_ID: tte-/,'POST_ID: other-')],
 ['revision',i=>i.body=i.body.replace('REVISION: 1','REVISION: 2')],
 ['target',i=>i.body=i.body.replace(/TARGETS: \w+/,'TARGETS: personal')],
 ['title',i=>i.title='[APPROVED LINKEDIN] another creative'],
 ['schedule',i=>i.body=i.body.replace('17:30:00','18:30:00')],
 ['QA',i=>i.body=i.body.replace('CONTENT_QA: PASS','CONTENT_QA: FAIL')],
]) test('migration rejects original approval '+label,()=>{const f=clone();f.issues.filter(i=>[294,286].includes(i.number)).forEach(mutate);assert.equal(repurpose(f).size,0);});
test('original acceptance must be trusted, unique and match the removed Buffer ID',()=>{
 const f=clone();f.comments[294][0].user.id=1;assert.deepEqual([...repurpose(f).keys()],['6a89fadfdeb4b57dfea8a80c']);
 const g=clone();g.comments[294].push({...g.comments[294][0],body:g.comments[294][0].body.replaceAll('6a89fc2ddeb4b57dfea8b628','another-id')});assert.deepEqual([...repurpose(g).keys()],['6a89fadfdeb4b57dfea8a80c']);
});
