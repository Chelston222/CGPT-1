# Chelsi's Crown — Klaviyo Deployment Package

Status: STAGING / NO LIVE SENDS
Owner: Chelsi's Crown
Delivery partner: 222Emails
Billing: client-owned

## Purpose
Build a reproducible Client Return System for Chelsi's Crown using Klaviyo as the messaging/data layer and GitHub as the source of truth.

## Operating rules
1. No private API keys, customer data, email addresses, phone numbers or sensitive client material in this public repository.
2. All production credentials live only in GitHub Actions secrets or the client-owned Klaviyo account.
3. Default deployment mode is `dry-run`.
4. API-created flows remain draft until a separate human launch approval.
5. No imported profile is treated as marketable solely because it exists in a booking/customer export.
6. Unknown consent is quarantined.
7. Manual UI work is reserved for provider-required setup, billing, domain authentication, visual QA and repair.

## Commercial system
Discover → Capture → Convert → Prepare → Deliver → Aftercare → Review/Referral → Rebook → Reactivate → VIP/Retention.

## Build order
- Account + brand config
- Properties + consent model
- Lists + segments
- Master templates
- Flow definitions
- QA tests
- Dry-run deployment
- Client account creation
- Scoped private API key
- Draft deployment
- Read-back verification
- Human launch approval

## External blockers
Only client-owned account/access and confirmed public booking/contact links should block production deployment. Everything else is designed to be completed in advance.
