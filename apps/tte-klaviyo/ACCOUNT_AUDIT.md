# 222 Emails Klaviyo Account Audit

Audited: 12 August 2026

Source: live read-only Klaviyo Accounts/Images/Forms/Profiles/Metrics API discovery through the authenticated 222 Emails private key.

## Confirmed account identity

- Account ID: `Ra4Qrb`
- Public API key / Site ID: `Ra4Qrb`
- Test account: `false`
- Time zone: `Europe/London`
- Website recorded in Klaviyo: `http://222emails.com`
- Default sender name: `Triple Two Emails`
- Default sender email: `hello@222emails.com`

## Configuration anomalies to review

- Preferred currency currently reports as **USD**.
- Account locale currently reports as **en-US**.

For a UK-facing 222 Emails account, both are plausible configuration drift. They are not being changed automatically because currency/locale are account-wide settings and could affect reporting, presentation or other resources. Confirm in the Klaviyo UI whether the intended settings should be GBP and UK English before changing them.

## Capability inventory

The current private key can successfully read:

- Accounts
- Images
- Forms
- Profiles
- Metrics

Current Forms API inventory returned **0 forms**.

A read-only probe against the Sending Domains endpoint did not return usable domain-health data under the current stable request; therefore sending-domain authentication remains unverified rather than assumed healthy.

## Security conclusion

The public Site ID `Ra4Qrb` is suitable for browser-side Klaviyo client APIs. The private API key remains GitHub/secure-server only and must never be embedded in website JavaScript.
