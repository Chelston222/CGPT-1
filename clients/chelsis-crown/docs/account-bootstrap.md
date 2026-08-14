# Chelsi's Crown — Klaviyo Account Bootstrap Runbook

Use this when creating the client-owned Klaviyo account.

## Ownership
- Account owner: Chelsi / Chelsi's Crown.
- Billing method: Chelsi's Crown.
- 222Emails receives only the minimum access required for implementation and optimisation.
- Do not use a 222Emails-owned billing method or make 222Emails the permanent account owner.

## Account creation
1. Create the Klaviyo account using the client-approved business email.
2. Set business name to Chelsi's Crown.
3. Set currency to GBP.
4. Set timezone to Europe/London.
5. Complete business address/footer identity fields with client-confirmed details.
6. Configure sender name and reply-to with client-confirmed values.
7. Enable MFA for owner/admin users.

## Sending infrastructure
1. Confirm whether Chelsi controls a sending domain.
2. If yes, configure Klaviyo branded sending domain/authentication and verify DNS.
3. If no, do not invent or purchase a domain without approval; document the temporary path and migration plan.
4. Send authentication tests before any marketing audience is imported.

## API access
1. Create a private API key in the Chelsi-owned Klaviyo account.
2. Grant only scopes needed for the deployment phase, expected to include relevant read/write access for templates, lists, segments and flows.
3. Put the key only into the GitHub Actions secret named `KLAVIYO_CHELSIS_CROWN_PRIVATE_KEY`.
4. Never paste the key into source files, issues, Drive docs or chat logs.
5. Rotate the key if accidental exposure is suspected.

## Deployment sequence
1. Run repository validation.
2. Run `dry-run` workflow.
3. Review planned resources.
4. Run `draft` deployment.
5. Read back Klaviyo resources and compare names/counts/settings.
6. Build/seed any provider-required flow definitions inside the real Klaviyo account in Draft.
7. Fetch and normalise those definitions for reproducible cloning.
8. Test with internal profiles only.
9. Import only consent-resolved customer data.
10. Activate in controlled waves after explicit approval.

## Never do during bootstrap
- No mass profile import before consent mapping.
- No live campaigns.
- No live flows.
- No SMS plan purchase without an explicit decision.
- No invented service prices, booking links or appointment policies.
