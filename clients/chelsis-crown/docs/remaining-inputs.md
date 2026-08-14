# Chelsi's Crown — Final Inputs Before Account Push

These are the only business-specific inputs still allowed to block a production-quality deployment.

## From Chelsi / public verification
- Confirmed booking route or confirmation that no booking platform exists.
- Confirmed service list and current prices.
- Typical return/maintenance interval by major service.
- Preparation instructions by service.
- Aftercare instructions by service.
- Cancellation/reschedule/no-show policy.
- Review destination/link.
- Current pop-up dates, location, capacity and eligible services.
- Approved business email / reply-to address.
- Confirmed business/postal address for compliant footer/account identity.
- Controlled domain, if any.
- Existing customer data export source/location.
- Consent evidence available with that export.

## When the account is created
- Account owner login controlled by Chelsi.
- Billing method added by Chelsi.
- GBP + Europe/London confirmed.
- MFA enabled.
- 222Emails implementation access added.
- Scoped private API key created and stored only as GitHub Actions secret.
- Sending domain authenticated if available.

## Decision rule
If a field above remains unknown, do not guess it. Keep the relevant copy, flow condition or integration adapter in staging until confirmed. Unknown data must never be converted into a customer-facing claim.
