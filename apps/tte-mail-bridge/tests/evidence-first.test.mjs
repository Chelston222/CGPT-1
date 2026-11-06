import test from 'node:test';
import assert from 'node:assert/strict';
import { approvedMessageFingerprint, validateColdPreAudit } from '../netlify/functions/_shared/preaudit-gate.mjs';
import { validateOutbound } from '../netlify/functions/_shared/validation.mjs';
import { REQUIRED_OPT_OUT } from '../netlify/functions/_shared/constants.mjs';

function fixture() {
  const now = new Date().toISOString();
  const data = {
    to: ['owner@example.org'],
    subject: 'A consultation booking improvement',
    text: `I noticed the Book a Consultation CTA goes to a general enquiry form. I'd call this Request a consultation and make the expected confirmation clear.\n\n${REQUIRED_OPT_OUT}`,
    leadId: 'LEAD-123',
    touchNo: 1,
    idempotencyKey: 'LEAD-123|1',
    reviewState: 'APPROVED',
    reviewedBy: 'human-review-fixture',
    emailGate: {profile:'COLD_B2B',gateRef:'DELIV-TEST',addressGate:'PASS',senderGate:'PASS',finalPermission:'EMAIL ALLOWED',verifiedAt:now,authorityEvidence:'Current legal, contact and sender evidence',evidenceScore:95},
    compliance: {companyType:'corporate',legalBasis:'consent',recipientPermission:'consent',permissionEvidence:'Controlled test permission',permissionRecordedAt:now},
  };
  data.preAudit = {
    auditId: 'AUDIT-LEAD-123',
    leadId:data.leadId,
    touchNo:data.touchNo,
    recipient:data.to[0],
    evidenceType:'OBSERVED',
    observedFinding:'The clinic website sends Book a Consultation to a general enquiry form rather than confirming an appointment.',
    sourceUrl:'https://example.org/consultations',
    checkedAt:now,
    commercialRisk:'Visitors may mistake a general form enquiry for a confirmed appointment.',
    recommendedFix:'Call this Request a consultation and explain how staff confirm an appointment time.',
    observationAnchor:'general enquiry form',
    fixAnchor:'Request a consultation',
    reviewedBy:'Independent human reviewer',
    reviewedAt:now,
    humanReviewPass:true,
    proofAttributionReviewPass:true,
    approvedMessageSha256:'',
  };
  data.preAudit.approvedMessageSha256=approvedMessageFingerprint(data);
  return data;
}

test('valid dated, identity-bound observed finding and approved final copy pass',()=>{
  const q=fixture();
  assert.deepEqual(validateColdPreAudit(q),[]);
  const integrated=validateOutbound(q,{requireEmailGate:true});
  assert.equal(integrated.ok,true, integrated.errors.join(', '));
});

test('missing pre-audit fails every cold touch, even if 95-point gate passes',()=>{
  for(const touchNo of [1,2,3]){
    const q=fixture();q.touchNo=touchNo;q.idempotencyKey=`LEAD-123|${touchNo}`;delete q.preAudit;
    assert.ok(validateOutbound(q,{requireEmailGate:true}).errors.includes('preaudit_required'));
  }
});

test('human approval and evidence type cannot be fabricated from generic state labels',()=>{
  const q=fixture();q.preAudit.humanReviewPass=false;q.preAudit.evidenceType='INFERRED';
  const errors=validateColdPreAudit(q);
  assert.ok(errors.includes('preaudit_human_review_pass_required'));
  assert.ok(errors.includes('preaudit_observed_evidence_required'));
});

test('source and human review freshness independently expire',()=>{
  const q=fixture();q.preAudit.checkedAt=new Date(Date.now()-40*24*60*60*1000).toISOString();
  assert.ok(validateColdPreAudit(q).includes('preaudit_source_stale_or_missing'));
  q.preAudit.checkedAt=new Date().toISOString();q.preAudit.reviewedAt=new Date(Date.now()-5*24*60*60*1000).toISOString();
  assert.ok(validateColdPreAudit(q).includes('preaudit_recent_human_review_required'));
});

test('wrong recipient, lead, or touch cannot reuse someone else\'s audit',()=>{
  const q=fixture();q.to=['new-owner@example.org'];q.leadId='LEAD-456';q.touchNo=2;
  const e=validateColdPreAudit(q);
  assert.ok(e.includes('preaudit_recipient_mismatch'));
  assert.ok(e.includes('preaudit_lead_id_mismatch'));
  assert.ok(e.includes('preaudit_touch_no_mismatch'));
});

test('generic message or removed practical fix fails the text-anchoring gate',()=>{
  const q=fixture();q.text=`I looked at your clinic. How long have you been running it?\n\n${REQUIRED_OPT_OUT}`;
  q.preAudit.approvedMessageSha256=approvedMessageFingerprint(q);
  const e=validateColdPreAudit(q);
  assert.ok(e.includes('preaudit_finding_missing_from_message'));
  assert.ok(e.includes('preaudit_fix_missing_from_message'));
});

test('last-minute body or subject edits invalidate exact approved copy',()=>{
  const q=fixture();q.subject='Changed subject';
  assert.ok(validateColdPreAudit(q).includes('preaudit_approved_copy_fingerprint_mismatch'));
  const b=fixture();b.text+=' Extra claim';
  assert.ok(validateColdPreAudit(b).includes('preaudit_approved_copy_fingerprint_mismatch'));
});

test('anonymous £15k to £25k proof must name four months and not invent an intervention',()=>{
  const q=fixture();q.text+=' We worked with a clinic that went from £15k to £25k per month.';
  q.preAudit.approvedMessageSha256=approvedMessageFingerprint(q);
  assert.ok(validateColdPreAudit(q).includes('preaudit_case_four_month_timeframe_required'));
  q.text+=' This was over four months, by implementing a made-up fix.';
  q.preAudit.approvedMessageSha256=approvedMessageFingerprint(q);
  assert.ok(validateColdPreAudit(q).includes('preaudit_unverified_case_causation'));
});

test('warm-requested, appointment and client lifecycle do not receive cold-acquisition audit requirements',()=>{
  for(const profile of ['WARM_REQUESTED','APPOINTMENT','CLIENT_LIFECYCLE','INTERNAL_OPERATIONAL']){
    const q=fixture();q.emailGate.profile=profile;delete q.preAudit;
    assert.deepEqual(validateColdPreAudit(q),[]);
  }
});

test('cold follow-up needs per-touch audit and exact approved text',()=>{
  const q=fixture();q.touchNo=2;q.idempotencyKey='LEAD-123|2';
  assert.ok(validateColdPreAudit(q).includes('preaudit_touch_no_mismatch'));
  q.preAudit.touchNo=2;q.preAudit.approvedMessageSha256=approvedMessageFingerprint(q);
  assert.deepEqual(validateColdPreAudit(q),[]);
});
