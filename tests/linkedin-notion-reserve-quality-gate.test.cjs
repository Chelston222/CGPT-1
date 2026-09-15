'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateNotionQualityGate } = require('../scripts/linkedin-notion-quality-gate.cjs');
const rich = (value) => ({ rich_text: [{ plain_text: value, text: { content: value } }] });
const select = (value) => ({ select: { name: value } });
function page(overrides = {}) {
  return { object:'page', id:'3dbe72eb-8587-81e1-8d17-d7a1725ba008', archived:false, in_trash:false, properties:{
    'Content Decision':select('Keep'), Approval:select('Approved'), 'Anti-DNA | Pass':{checkbox:true},
    'Automation Status':select('Ready to Sync'), 'Buffer Status':select('Ready for Buffer'), 'Asset Ready':{checkbox:true}, 'Automation Ready':{checkbox:true},
    'Final Copy':rich('Locked reserve caption'), 'Publish Payload':rich('Locked reserve caption'), 'Scheduled At':{date:{start:'2026-09-18T08:15:00+01:00'}},
    'Reserve Enabled':{checkbox:true}, 'Publication State':select('Approved for Publish'), 'Publication Route':select('Buffer'), 'Manual Review Required':{checkbox:false}, 'Source Needed':{checkbox:false},
    'Sync Error':rich(''), 'External Post ID':rich(''), 'Post URL':{url:null}, Platform:select('LinkedIn Personal'), 'Posting Identity':rich('Chelston personal (personal)'), Version:rich('Visual Reserve Imagegen Final 1'),
    'Media URL':{url:'https://raw.githubusercontent.com/Chelston222/CGPT-1/main/assets/linkedin-generated/reserve-01.png'}, 'Media SHA256':rich('a'.repeat(64)), 'Media Bytes':{number:1014086},
    'Alt Text':rich('Standalone client return poster.'), 'Bridge Fingerprint':rich('bridge-fingerprint-1'), 'Bridge Status':select('Waiting Owner Approval'), ...overrides.properties },
    ...Object.fromEntries(Object.entries(overrides).filter(([key])=>key!=='properties')) };
}
function queuePost(overrides = {}) { return { id:'tte-reserve-133', revision:1, sourceType:'notion_reserve', sourceUrl:'https://app.notion.com/3dbe72eb858781e18d17d7a1725ba008', targets:['personal'], scheduledAt:{personal:'2026-09-18T07:15:00Z'}, copy:{default:'Locked reserve caption'}, mediaUrl:'https://raw.githubusercontent.com/Chelston222/CGPT-1/main/assets/linkedin-generated/reserve-01.png', mediaSha256:'a'.repeat(64), mediaBytes:1014086, mediaAlt:'Standalone client return poster.', bridgeFingerprint:'bridge-fingerprint-1', ...overrides }; }
test('exact staged reserve revision passes',()=>{ const r=evaluateNotionQualityGate(page(),null,queuePost()); assert.equal(r.pass,true); assert.equal(r.snapshot.bridgeFingerprintMatches,true); });
test('revoked approval blocks staged reserve',()=>{ const r=evaluateNotionQualityGate(page({properties:{Approval:select('Changes Needed')}}),null,queuePost()); assert.equal(r.pass,false); assert.match(r.reasons.join(' '),/Approval/); });
test('caption schedule and identity drift block dispatch',()=>{ const r=evaluateNotionQualityGate(page({properties:{'Final Copy':rich('Changed'),'Publish Payload':rich('Changed'),'Scheduled At':{date:{start:'2026-09-18T09:15:00+01:00'}},'Posting Identity':rich('222Emails | Retention School (secondary)')}}),null,queuePost()); assert.equal(r.pass,false); const s=r.reasons.join(' '); assert.match(s,/Final Copy/); assert.match(s,/Scheduled At/); assert.match(s,/target/); });
test('media proof and fingerprint drift block dispatch',()=>{ const r=evaluateNotionQualityGate(page({properties:{'Media SHA256':rich('b'.repeat(64)),'Media Bytes':{number:1014087},'Bridge Fingerprint':rich('changed')}}),null,queuePost()); assert.equal(r.pass,false); const s=r.reasons.join(' '); assert.match(s,/Media SHA256/); assert.match(s,/Media Bytes/); assert.match(s,/Bridge Fingerprint/); });
test('unstaged bridge state blocks dispatch',()=>{ const r=evaluateNotionQualityGate(page({properties:{'Bridge Status':select('Not Staged')}}),null,queuePost()); assert.equal(r.pass,false); assert.match(r.reasons.join(' '),/Bridge Status/); });