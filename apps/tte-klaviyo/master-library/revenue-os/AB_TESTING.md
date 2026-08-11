# A/B Testing Framework

The purpose of testing is to learn which decision lever improves the commercial outcome, not to generate endless cosmetic variants.

## Priority order

1. **Offer / value proposition** — what outcome is being promised and for whom.
2. **Message angle** — problem, mechanism, proof, objection, urgency, founder or education.
3. **CTA / next action** — clarity and friction of the requested action.
4. **Proof placement** — before CTA vs after product explanation.
5. **Layout system** — minimal vs editorial vs product vs proof-first vs founder-human.
6. **Subject line / preheader pairing**.
7. **Minor visual treatment** only after the higher-leverage hypotheses have evidence.

## Guardrails

- Change one primary decision variable per controlled test where practical.
- Define the hypothesis before launch.
- Define primary metric and guardrail metrics before launch.
- Never optimise clicks at the expense of conversion quality, refunds, unsubscribes or complaints.
- Do not call a winner from a tiny sample merely because the percentage is larger.
- Keep the test long enough to cover the relevant buying cycle where volume permits.
- Preserve the loser and test metadata for learning, but retire repeated underperformers.

## Suggested metric hierarchy

### Revenue recovery
Primary: placed-order rate or recovered revenue per eligible recipient.
Guardrails: unsubscribe rate, spam complaints, margin impact, refund/cancellation rate.

### Conversion lift
Primary: conversion rate or revenue per recipient.
Guardrails: click quality, discount dependence, unsubscribe/complaint rate.

### Automated revenue
Primary: flow revenue per eligible recipient and incremental conversion where measurable.
Guardrails: message fatigue, overlap with other flows, suppression health.

### Customer retention
Primary: repeat purchase, replenishment or reactivation conversion.
Guardrails: discount depth, churn/unsubscribe, margin.

### Lifecycle revenue
Primary: revenue per recipient/customer over the target lifecycle window.
Guardrails: deliverability, list health, complaint rate and customer experience.

## Default hypothesis examples

- **Abandoned cart:** objection-handling proof before CTA will outperform a generic reminder for high-consideration products.
- **Welcome:** product discovery will outperform immediate discount-led selling when choice overload is the main friction.
- **Post-purchase:** next-step education will improve repeat engagement when customer success requires setup or behaviour change.
- **Win-back:** new-value/relevance messaging will outperform blanket discounting for customers whose original need may still exist.
- **VIP:** access or recognition with tangible value will outperform generic loyalty language.

## Test log fields

`client | journey | template_slug | layout_variant | module_set | hypothesis | primary_metric | guardrails | audience | start | end | result | confidence_note | decision | next_test`
