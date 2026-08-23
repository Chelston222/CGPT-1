'use strict';

const base = require('./linkedin-performance-learning.cjs');

function inferTraits(copy = '') {
  const text = String(copy).trim();
  const lower = text.toLowerCase();
  const traits = new Set(base.inferTraits(text));

  // The original broad phrase marker conflated acquisition advice with a
  // contrarian diagnosis. Split it so the learner can tell those apart.
  traits.delete('more_leads_frame');
  const acquisitionMention = /\b(more leads?|more traffic|lead generation|acquisition|fresh attention|new leads?)\b/i.test(text);
  const acquisitionContrast = acquisitionMention && /\b(not always|before (?:spending|buying|increasing|adding)|but first|instead|rather than|without fixing|same gaps?|same leak|already (?:wanted|showed interest)|what happened to)\b/i.test(text);
  if (acquisitionContrast) traits.add('acquisition_contrast');
  else if (acquisitionMention) traits.add('acquisition_frame');

  if (/\b(forget|forgot|busy|meant to|remember|memory|life got|distract|attention battle|good intentions?)\b/i.test(text)) {
    traits.add('human_behaviour');
  }

  const proofTerms = /\b(proof|evidence|result|metric|benchmark|attribution|claim|demonstrat|observed|before the system|problem existed|what was happening before)\b/i.test(text);
  const proofBoundary = /\b(not prove|does not prove|not automatically|rather than|before showing|truth|narrower|specificity|inflated certainty|actual(?:ly)? observed)\b/i.test(text);
  if (proofTerms && proofBoundary) traits.add('proof_discipline');
  else if (proofTerms) traits.add('proof_or_evidence');

  if (/\b(owner|ownership|responsib|accountab|handoff|hand-off|takes over|staff member|human follow-up|who notices|who checks|who owns)\b/i.test(text)) {
    traits.add('operational_ownership');
  }

  if (/\b(customer state|client state|classif|segment|due to rebook|overdue|cancelled|no-show|dormant|reactivated|already booked|first-time client|warm enquir)\b/i.test(text)) {
    traits.add('state_classification');
  }

  if (/\b(stop rule|stop condition|stop the reminder|pause automation|opted out|opt-out|exit the sequence|sequence should stop)\b/i.test(text)) {
    traits.add('stop_logic');
  }

  if (/\b(first|1\.|1\)|five lists|four lists|six parts|three questions|checklist|framework|matrix|map what happens|trace each)\b/i.test(text)) {
    traits.add('framework_or_checklist');
  }

  if (/\b(i caught myself|one thing i|i used to think|i would rather|i am becoming|i'm building|building 222emails|building triple two emails)\b/i.test(text)) {
    traits.add('builder_in_public');
  }

  if (/\b(discount|promotion|price|offer)\b/i.test(text) && /\b(before|not automatically|rather than|one lever|isn[’']t|is not)\b/i.test(text)) {
    traits.add('anti_discount_diagnosis');
  }

  if (/\b(when|timing|return window|decision window|too early|too late|right moment|right time|normal return)\b/i.test(text)) {
    traits.add('timing_logic');
  }

  return [...traits];
}

module.exports = { inferTraits };
