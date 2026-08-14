# Chelsi's Crown — Klaviyo Acceptance Gates

A build cannot be called deploy-ready unless every hard gate passes.

## Hard gates
- [ ] No secrets or client PII committed to GitHub.
- [ ] Klaviyo private key exists only in secret storage.
- [ ] Account is client-owned and client-billed.
- [ ] Sender/reply-to identity is confirmed.
- [ ] Physical sender identity/footer requirements are configured.
- [ ] Sending domain/authentication is completed where applicable.
- [ ] Consent state model is implemented.
- [ ] Amber and red profiles are excluded from marketing.
- [ ] Suppressed profiles cannot re-enter marketing flows accidentally.
- [ ] Human-handover state suppresses automation where required.
- [ ] Every flow has a documented trigger, entry condition and exit condition.
- [ ] Every flow is deployed as Draft first.
- [ ] No flow is activated by the deployment script.
- [ ] No false scarcity or invented availability claims exist.
- [ ] No unverified booking/service/price claims exist.
- [ ] Every marketing email has a working unsubscribe route.
- [ ] Dynamic first-name fields have a fallback.
- [ ] All URLs pass validation.
- [ ] All customer-facing templates pass mobile QA.
- [ ] All customer-facing templates pass desktop QA.
- [ ] Plain-text rendering is acceptable.
- [ ] Dark-mode visual check completed.
- [ ] Test profile can enter each intended flow.
- [ ] Test profile exits each flow on booking/handover/suppression as intended.
- [ ] Duplicate event test does not create duplicate sends.
- [ ] Cancellation/reschedule test prevents wrong appointment reminders.
- [ ] Read-back verification matches expected Klaviyo resource names/counts.
- [ ] Launch approval is a separate manual action.

## Scenario set
1. New consented subscriber, no booking.
2. New subscriber who books immediately.
3. Enquiry that books after message one.
4. Enquiry that never books.
5. Existing customer with valid marketing consent.
6. Existing customer with unknown consent.
7. Suppressed customer.
8. Customer with human handover enabled.
9. Appointment cancelled before preparation message.
10. Appointment rescheduled.
11. Appointment completed normally.
12. Client leaves review before review reminder.
13. Client books before rebooking reminder.
14. Client becomes overdue.
15. Lapsed client rebooks after first reactivation email.
16. Duplicate booking event.
17. Missing first name.
18. Missing booking URL placeholder.
19. Unengaged profile enters sunset.
20. Re-engaged profile exits sunset.

## Launch waves
Wave 0: internal test profiles only.
Wave 1: transactional/service-support journeys that have been validated for lawful use and are not being misclassified as marketing.
Wave 2: welcome/new-interest journey for explicit subscribers.
Wave 3: rebooking for validated marketing-eligible clients.
Wave 4: lapsed recovery in a small controlled cohort.
Wave 5: campaigns/cancellation fills/pop-up journeys after baseline performance and deliverability are known.

## Rollback rule
If a live flow materially misfires, pause the affected flow first, preserve evidence, identify the exact source definition/commit, correct in staging, rerun tests, then redeploy. Do not patch production silently without back-porting the fix to GitHub.
