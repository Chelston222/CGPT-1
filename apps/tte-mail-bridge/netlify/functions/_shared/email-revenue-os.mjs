const CHANNEL_CONTEXTS = new Set(['owned', 'cold_b2b', 'client_lifecycle', 'repurpose']);
const CTA_MODES = new Set(['NONE', 'SOFT', 'DIAGNOSTIC', 'PAID_DIAGNOSTIC', 'IMPLEMENTATION', 'DIRECT_OFFER']);
const READY_STATES = new Set(['READY', 'APPROVED_FOR_SEND', 'APPROVED_FOR_PUBLISH']);
const CLAIMED_WINNER_STATES = new Set(['WINNER', 'CORE']);
const EXTERNAL_EVENT_STATES = new Set(['SCHEDULED', 'SENT', 'PUBLISHED']);
function textValue(value) { return typeof value === 'string' ? value.trim() : ''; }
function upper(value) { return textValue(value).toUpperCase(); }
function firstDefined(...values) { return values.find((value) => value !== undefined && value !== null && value !== ''); }
export function getEmailRevenueOsMetadata(input) { return input?.emailRevenueOs || input?.email_revenue_os || null; }
export function validateEmailRevenueOs(input, opts = {}) {
  const metadata = getEmailRevenueOsMetadata(input);
  if (!metadata) return { ok: true, errors: [], warnings: [], normalized: null, applied: false };
  const errors = []; const warnings = [];
  const channelContext = textValue(metadata.channelContext || metadata.channel_context).toLowerCase();
  const ctaMode = upper(metadata.ctaMode || metadata.cta_mode);
  const releaseState = upper(metadata.releaseState || metadata.release_state || metadata.approvalState || metadata.approval_state);
  const performanceState = upper(metadata.performanceState || metadata.performance_state || metadata.status);
  const externalEventState = upper(metadata.externalEventState || metadata.external_event_state);
  const currentFacing = metadata.currentFacing !== false && metadata.current_facing !== false;
  const primaryCtaCountRaw = firstDefined(metadata.primaryCtaCount, metadata.primary_cta_count, 0);
  const primaryCtaCount = Number(primaryCtaCountRaw);
  const qaScoreRaw = firstDefined(metadata.qaScore, metadata.qa_score);
  const qaScore = qaScoreRaw === undefined ? null : Number(qaScoreRaw);
  const hardFails = Array.isArray(metadata.hardFails || metadata.hard_fails) ? (metadata.hardFails || metadata.hard_fails).filter(Boolean) : [];
  const subject = String(input?.subject || ''); const body = String(input?.text || '');
  const preheader = String(firstDefined(metadata.preheader, input?.preheader, '') || ''); const copy = `${subject}\n${preheader}\n${body}`;
  if (!CHANNEL_CONTEXTS.has(channelContext)) errors.push('email_os_valid_channel_context_required');
  if (!CTA_MODES.has(ctaMode)) errors.push('email_os_valid_cta_mode_required');
  if (!Number.isInteger(primaryCtaCount) || primaryCtaCount < 0) errors.push('email_os_primary_cta_count_invalid'); else if (primaryCtaCount > 1) errors.push('email_os_multiple_primary_ctas_blocked');
  if (ctaMode === 'NONE' && primaryCtaCount > 0) errors.push('email_os_cta_none_conflicts_with_primary_cta');
  if (qaScore !== null && (!Number.isFinite(qaScore) || qaScore < 0 || qaScore > 100)) errors.push('email_os_qa_score_invalid');
  if (READY_STATES.has(releaseState)) { const threshold = metadata.flagship === true ? (opts.flagshipMinScore || 95) : (opts.generatedMinScore || 90); if (!Number.isFinite(qaScore)) errors.push('email_os_ready_requires_qa_score'); else if (qaScore < threshold) errors.push('email_os_ready_below_qa_threshold'); if (hardFails.length) errors.push('email_os_ready_with_hard_fails'); }
  if (currentFacing) {
    if (copy.includes('—')) errors.push('email_os_em_dash_blocked');
    if (/\b222\s+Emails\b/i.test(copy)) errors.push('email_os_noncanonical_brand_spacing');
    if (/https?:\/\/(?:www\.)?jotform\.com\b/i.test(copy) || /https?:\/\/form\.jotform\.com\b/i.test(copy)) errors.push('email_os_current_public_jotform_blocked');
    if (/\bRevenue Recovery Systems?\b/i.test(copy)) errors.push('email_os_superseded_formal_system_name');
  }
  if (preheader && subject.trim().toLowerCase() === preheader.trim().toLowerCase()) warnings.push('email_os_preheader_repeats_subject');
  if (channelContext === 'cold_b2b') {
    const leadState = upper(firstDefined(metadata.leadIdentificationState, metadata.lead_identification_state, input?.leadIdentificationState, input?.lead_identification_state));
    const namedResponsiblePerson = textValue(firstDefined(metadata.namedResponsiblePerson, metadata.named_responsible_person, input?.namedResponsiblePerson, input?.named_responsible_person));
    const providerPermissionEvidence = textValue(firstDefined(metadata.providerPermissionEvidence, metadata.provider_permission_evidence, input?.compliance?.permissionEvidence));
    const suppressionState = upper(firstDefined(metadata.suppressionState, metadata.suppression_state, input?.suppressionState, input?.suppression_state));
    const senderHealthGate = upper(firstDefined(metadata.senderHealthGate, metadata.sender_health_gate, input?.senderHealthGate, input?.sender_health_gate));
    const humanReviewState = upper(firstDefined(metadata.humanReviewState, metadata.human_review_state, input?.reviewState));
    const contactRouteClassification = textValue(firstDefined(metadata.legalContactRouteClassification, metadata.legal_contact_route_classification, input?.legalContactRouteClassification, input?.legal_contact_route_classification, input?.compliance?.companyType));
    if (leadState !== 'GREEN') errors.push('email_os_cold_requires_green_lead_identification');
    if (!namedResponsiblePerson) errors.push('email_os_cold_requires_named_responsible_person');
    if (!providerPermissionEvidence) errors.push('email_os_cold_requires_provider_permission_evidence');
    if (!['CLEAR','PASS','GREEN'].includes(suppressionState)) errors.push('email_os_cold_requires_clear_suppression_state');
    if (!['PASS','GREEN','VERIFIED'].includes(senderHealthGate)) errors.push('email_os_cold_requires_sender_health_gate');
    if (humanReviewState !== 'APPROVED') errors.push('email_os_cold_requires_human_review');
    if (!contactRouteClassification) errors.push('email_os_cold_requires_contact_route_classification');
  }
  if (CLAIMED_WINNER_STATES.has(performanceState)) { const evidence = firstDefined(metadata.performanceEvidence, metadata.performance_evidence, metadata.externalEventEvidence, metadata.external_event_evidence); if (!evidence || (typeof evidence === 'string' && evidence.trim().length < 3)) errors.push('email_os_winner_or_core_requires_evidence'); }
  if (EXTERNAL_EVENT_STATES.has(externalEventState)) { const evidence = firstDefined(metadata.externalEventEvidence, metadata.external_event_evidence, metadata.externalEventId, metadata.external_event_id); if (!evidence || (typeof evidence === 'string' && evidence.trim().length < 3)) errors.push('email_os_external_state_requires_event_evidence'); }
  if (metadata.creatorReference && metadata.creatorImitation === true) errors.push('email_os_creator_imitation_blocked');
  return { ok: errors.length === 0, errors, warnings, applied: true, normalized: {...metadata, channelContext, ctaMode, primaryCtaCount:Number.isInteger(primaryCtaCount)?primaryCtaCount:primaryCtaCountRaw, qaScore:Number.isFinite(qaScore)?qaScore:qaScoreRaw, hardFails, releaseState, performanceState, externalEventState, currentFacing} };
}
