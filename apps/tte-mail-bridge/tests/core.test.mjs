import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { encryptJson, decryptJson, decryptJsonAny, signState, verifyState } from '../netlify/functions/_shared/crypto.mjs';
import { validateOutbound } from '../netlify/functions/_shared/validation.mjs';
import { effectiveDailyCap, selectSender, accountEligibility } from '../netlify/functions/_shared/routing.mjs';
import { REQUIRED_OPT_OUT } from '../netlify/functions/_shared/constants.mjs';
import { buildMime } from '../netlify/functions/_shared/mime.mjs';
import { buildGoogleAuthorizationUrl, refreshAccessToken } from '../netlify/functions/_shared/google.mjs';
import { withinLondonSendingWindow } from '../netlify/functions/_shared/util.mjs';

const secret='this-is-a-long-enough-test-secret-123456';
const permission={recipientPermission:'consent',permissionEvidence:'CRM consent event #123',permissionRecordedAt:'2026-08-10T10:00:00Z'};

test('AES-GCM round trip, tamper resistance, record binding and rotation fallback',()=>{
  const enc=encryptJson({refresh_token:'secret-token'},secret);assert.deepEqual(decryptJson(enc,secret),{refresh_token:'secret-token'});
  const tampered=Buffer.from(enc.data,'base64url');tampered[0]^=1;assert.throws(()=>decryptJson({...enc,data:tampered.toString('base64url')},secret));
  const bound=encryptJson({refresh_token:'bound'},secret,'gmail-token:account-a');assert.throws(()=>decryptJson(bound,secret,'gmail-token:account-b'));
  assert.deepEqual(decryptJsonAny(bound,['wrong-secret-long-enough-123456',secret],'gmail-token:account-a'),{refresh_token:'bound'});
});

test('OAuth state is signed and expires',()=>{const token=signState({nonce:'n',exp:Date.now()+10000},secret);assert.equal(verifyState(token,secret).nonce,'n');assert.throws(()=>verifyState(token+'x',secret));assert.throws(()=>verifyState(signState({nonce:'n',exp:Date.now()-1},secret),secret));});

test('first touch requires corporate classification, lawful basis, provider permission, approval and opt-out',()=>{const base={to:['owner@example.co.uk'],subject:'Question',text:`Hello\n\n${REQUIRED_OPT_OUT}`,leadId:'L1',touchNo:1,idempotencyKey:'I1',compliance:{companyType:'corporate',legalBasis:'legitimate_interests',...permission},reviewState:'APPROVED',reviewedBy:'operator'};assert.equal(validateOutbound(base).ok,true);assert.ok(validateOutbound({...base,text:'no optout'}).errors.includes('mandatory_opt_out_missing'));assert.ok(validateOutbound({...base,compliance:{...base.compliance,companyType:'unknown'}}).errors.includes('uncertain_legal_category_blocked'));assert.ok(validateOutbound({...base,reviewState:'DRAFT',reviewedBy:null}).errors.includes('first_touch_human_approval_required'));});

test('legal basis alone never satisfies provider permission',()=>{const base={to:['owner@example.co.uk'],subject:'Question',text:`Hi\n${REQUIRED_OPT_OUT}`,leadId:'L2',touchNo:1,idempotencyKey:'I2',reviewState:'APPROVED',reviewedBy:'operator',compliance:{companyType:'corporate',legalBasis:'legitimate_interests'}};const check=validateOutbound(base);assert.equal(check.ok,false);assert.ok(check.errors.includes('provider_permission_required'));assert.ok(check.errors.includes('permission_evidence_required'));assert.ok(check.errors.includes('permission_recorded_at_required'));});

test('provider permission requires evidence and a valid recorded time',()=>{const base={to:['owner@example.co.uk'],subject:'Question',text:`Hi\n${REQUIRED_OPT_OUT}`,leadId:'L3',touchNo:1,idempotencyKey:'I3',reviewState:'APPROVED',reviewedBy:'operator',compliance:{companyType:'corporate',legalBasis:'consent',recipientPermission:'consent',permissionEvidence:'CRM record',permissionRecordedAt:'2026-08-10T10:00:00Z'}};assert.equal(validateOutbound(base).ok,true);assert.ok(validateOutbound({...base,compliance:{...base.compliance,permissionEvidence:''}}).errors.includes('permission_evidence_required'));assert.ok(validateOutbound({...base,compliance:{...base.compliance,permissionRecordedAt:'not-a-date'}}).errors.includes('permission_recorded_at_required'));});

test('sole trader needs consent or soft opt-in',()=>{const base={to:['owner@example.co.uk'],subject:'Question',text:`Hi\n${REQUIRED_OPT_OUT}`,leadId:'L4',touchNo:1,idempotencyKey:'I4',reviewState:'APPROVED',reviewedBy:'operator'};assert.equal(validateOutbound({...base,compliance:{companyType:'sole_trader',legalBasis:'legitimate_interests',...permission}}).ok,false);assert.equal(validateOutbound({...base,compliance:{companyType:'sole_trader',legalBasis:'consent',...permission}}).ok,true);});

test('warmup cap ramps conservatively',()=>{assert.equal(effectiveDailyCap({status:'WARMING',dailyCap:20,connectedAt:'2026-08-10T12:00:00Z'},new Date('2026-08-16T12:00:00Z')),9);});

test('router preserves continuity when safe but never overrides caps',()=>{const accounts=[{id:'a',email:'a@gmail.com',status:'ACTIVE',dailyCap:10,rolling24hCap:15,priority:0,health:{score:100}},{id:'b',email:'b@gmail.com',status:'ACTIVE',dailyCap:10,rolling24hCap:15,priority:0,health:{score:100}}];const now=new Date('2026-08-16T12:00:00Z');let r=selectSender({accounts,usageByAccount:{a:{sentToday:2,lastSentAt:'2026-08-16T10:00:00Z'},b:{sentToday:0,lastSentAt:'2026-08-16T10:00:00Z'}},leadId:'lead',continuityAccountId:'a',now});assert.equal(r.selected.accountId,'a');r=selectSender({accounts,usageByAccount:{a:{sentToday:10,lastSentAt:'2026-08-16T10:00:00Z'},b:{sentToday:0,lastSentAt:'2026-08-16T10:00:00Z'}},leadId:'lead',continuityAccountId:'a',now});assert.equal(r.selected.accountId,'b');});

test('MIME builder strips header injection and includes unsubscribe signal',()=>{const mime=buildMime({fromName:'Operator\r\nBcc: bad@example.com',fromEmail:'sender@gmail.com',to:'owner@example.com',subject:'Hello\r\nBcc: bad@example.com',text:'Body',leadId:'L1',touchNo:1,idempotencyKey:'I1'});const decoded=Buffer.from(mime.raw,'base64url').toString('utf8');assert.equal(decoded.includes('\r\nBcc: bad@example.com\r\n'),false);assert.match(decoded,/List-Unsubscribe: <mailto:sender@gmail\.com\?subject=unsubscribe>/);});

test('circuit breaker rejects repeated failures and minimum-gap bursts',()=>{const now=new Date('2026-08-16T12:00:00Z');const a={id:'a',status:'ACTIVE',enabled:true,dailyCap:10,rolling24hCap:15,minIntervalMinutes:6};assert.equal(accountEligibility(a,{sentToday:0,sentRolling24h:0,lastSentAt:'2026-08-16T11:58:00Z'},now).eligible,false);assert.ok(accountEligibility(a,{sentToday:0,sentRolling24h:0,lastSentAt:'2026-08-16T10:00:00Z',consecutiveFailures:3},now).reasons.includes('failure_circuit_breaker'));});

test('Google OAuth uses offline consent and narrow send scope',()=>{const url=new URL(buildGoogleAuthorizationUrl({clientId:'client',redirectUri:'https://example.com/cb',state:'signed'}));assert.equal(url.searchParams.get('access_type'),'offline');assert.equal(url.searchParams.get('prompt'),'consent');const scope=url.searchParams.get('scope');assert.match(scope,/gmail\.send/);assert.equal(scope.includes('gmail.readonly'),false);assert.equal(scope.includes('gmail.modify'),false);});

test('temporary token-refresh transport failure is safely retryable before Gmail submission',async()=>{const original=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('network down');};try{await assert.rejects(refreshAccessToken({refreshToken:'r',clientId:'c',clientSecret:'s'}),(err)=>err?.safeRetry===true&&err?.code==='TOKEN_REFRESH_TRANSPORT');}finally{globalThis.fetch=original;}});

test('Europe/London sending window honours BST boundaries',()=>{assert.equal(withinLondonSendingWindow(new Date('2026-08-16T06:59:00Z'),8,18),false);assert.equal(withinLondonSendingWindow(new Date('2026-08-16T07:00:00Z'),8,18),true);assert.equal(withinLondonSendingWindow(new Date('2026-08-16T16:59:00Z'),8,18),true);assert.equal(withinLondonSendingWindow(new Date('2026-08-16T17:00:00Z'),8,18),false);});

test('Mailopoly agent hook cannot bypass the control-plane queue',async()=>{const source=await readFile(new URL('../netlify/functions/agent-hook.ts',import.meta.url),'utf8');assert.match(source,/enqueueOutbound/);assert.match(source,/MAILOPOLY_TO_TTE_CONTROL_PLANE/);assert.equal(source.includes('createTransport('),false);assert.equal(source.includes('sendMail('),false);});

test('legacy direct-send bypass artifacts are absent',async()=>{const paths=[new URL('../netlify/functions/direct-dispatch.ts',import.meta.url),new URL('../netlify/functions/queue-poller.ts',import.meta.url),new URL('../scripts/process-queue.mjs',import.meta.url),new URL('../../../.github/workflows/tte-direct-queue-runner.yml',import.meta.url)];for(const path of paths){await assert.rejects(access(path),(err)=>err?.code==='ENOENT');}});
