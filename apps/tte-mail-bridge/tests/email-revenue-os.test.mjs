import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOutbound } from '../netlify/functions/_shared/validation.mjs';
import { REQUIRED_OPT_OUT } from '../netlify/functions/_shared/constants.mjs';
function base(overrides={}) { return {to:['owner@example.co.uk'],subject:'A client-return question',text:`Useful factual message.\n\n${REQUIRED_OPT_OUT}`,leadId:'ERO-1',touchNo:1,idempotencyKey:'ERO-1|1',reviewState:'APPROVED',reviewedBy:'test',compliance:{companyType:'corporate',legalBasis:'consent',recipientPermission:'consent',permissionEvidence:'Test consent evidence',permissionRecordedAt:'2026-08-30T08:00:00Z'},...overrides}; }
function owned(overrides={}) { return {channelContext:'owned',ctaMode:'NONE',primaryCtaCount:0,qaScore:95,hardFails:[],releaseState:'READY',...overrides}; }
function cold(overrides={}) { return {channelContext:'cold_b2b',ctaMode:'SOFT',primaryCtaCount:1,qaScore:95,hardFails:[],releaseState:'READY',leadIdentificationState:'GREEN',namedResponsiblePerson:'Alex Owner',providerPermissionEvidence:'Test consent evidence',suppressionState:'CLEAR',senderHealthGate:'GREEN',humanReviewState:'APPROVED',legalContactRouteClassification:'corporate',...overrides}; }
test('legacy untagged valid payload remains backwards compatible',()=>assert.equal(validateOutbound(base()).ok,true));
test('valid owned Email Revenue OS payload passes',()=>assert.equal(validateOutbound(base({emailRevenueOs:owned()})).ok,true));
test('current-facing em dash fails',()=>{const r=validateOutbound(base({subject:'The appointment — and what happens next',emailRevenueOs:owned()}));assert.ok(r.errors.includes('email_os_em_dash_blocked'));});
test('current-facing Jotform route fails',()=>{const r=validateOutbound(base({text:`See https://form.jotform.com/123.\n\n${REQUIRED_OPT_OUT}`,emailRevenueOs:owned()}));assert.ok(r.errors.includes('email_os_current_public_jotform_blocked'));});
test('superseded formal system name fails',()=>{const r=validateOutbound(base({text:`Our Revenue Recovery System helps.\n\n${REQUIRED_OPT_OUT}`,emailRevenueOs:owned()}));assert.ok(r.errors.includes('email_os_superseded_formal_system_name'));});
test('more than one primary CTA fails',()=>{const r=validateOutbound(base({emailRevenueOs:owned({ctaMode:'DIAGNOSTIC',primaryCtaCount:2})}));assert.ok(r.errors.includes('email_os_multiple_primary_ctas_blocked'));});
test('READY below QA floor fails',()=>{const r=validateOutbound(base({emailRevenueOs:owned({qaScore:89})}));assert.ok(r.errors.includes('email_os_ready_below_qa_threshold'));});
test('flagship READY requires 95',()=>{const r=validateOutbound(base({emailRevenueOs:owned({qaScore:94,flagship:true})}));assert.ok(r.errors.includes('email_os_ready_below_qa_threshold'));});
test('cold B2B requires GREEN Lead Identification',()=>{const r=validateOutbound(base({emailRevenueOs:cold({leadIdentificationState:'AMBER'})}));assert.ok(r.errors.includes('email_os_cold_requires_green_lead_identification'));});
test('cold B2B requires named responsible person',()=>{const r=validateOutbound(base({emailRevenueOs:cold({namedResponsiblePerson:''})}));assert.ok(r.errors.includes('email_os_cold_requires_named_responsible_person'));});
test('WINNER or CORE requires performance evidence',()=>{const r=validateOutbound(base({emailRevenueOs:owned({performanceState:'WINNER'})}));assert.ok(r.errors.includes('email_os_winner_or_core_requires_evidence'));});
test('SENT state requires external-event evidence',()=>{const r=validateOutbound(base({emailRevenueOs:owned({externalEventState:'SENT'})}));assert.ok(r.errors.includes('email_os_external_state_requires_event_evidence'));});
test('valid Email Revenue OS cold payload passes all additive gates',()=>assert.equal(validateOutbound(base({emailRevenueOs:cold()})).ok,true));
