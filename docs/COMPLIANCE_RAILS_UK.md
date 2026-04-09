# UK Compliance Rails

## Purpose
These rails reduce legal and reputational risk for 222Emails outbound and retention activity.

## Cold outreach default posture
Focus on corporate B2B contacts first.
If the legal category is uncertain, do not progress to send-ready.

## Minimum outbound requirements
Every cold email draft must:
- clearly identify the sender and business
- make the commercial intent obvious enough to avoid deception
- include a valid and easy opt-out path
- avoid misleading subject lines and false claims
- avoid fabricated personalisation

## Data minimisation
Store only the minimum fields required for qualification, contact, and audit.
Do not collect speculative personal data.
Do not retain stale or low-confidence personal data longer than necessary.

## Review requirements
A human should review:
- first-touch outreach drafts
- any message to a legally uncertain recipient type
- any message using a stronger claim than normal
- any campaign variant created after a major prompt change

## Klaviyo split
Klaviyo is for:
- opted-in lists
- client retention
- nurture sequences
- lifecycle messaging

Klaviyo is not the default engine for cold lead acquisition.

## Logging
Keep logs for:
- source of lead
- qualification decision
- draft creation time
- reviewer decision
- send time
- unsubscribe or negative response outcomes

## Kill-switch triggers
Pause or block outbound when:
- duplicate contact risk appears
- unsubscribe text is missing
- category confidence is low
- bounce or complaint patterns appear
- Gmail sending limits are at risk

## Operator note
This file is a practical control layer, not legal advice.
Where uncertainty remains, preserve the stricter path.
