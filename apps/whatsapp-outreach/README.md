# 222Emails WhatsApp Outreach Engine

A social-first WhatsApp Business Platform layer for 222Emails outreach and client-return workflows.

## What it does

- Queues WhatsApp-ready prospects with business, contact, phone, LinkedIn URL, eligibility, message and PDF URL.
- Hard-gates automated sends to contacts marked `opted_in` or `customer_initiated`.
- Sends free-form text inside an eligible customer-service context.
- Sends PDF/document messages by Meta media ID or public HTTPS URL.
- Sends approved WhatsApp templates for eligible business-initiated messaging.
- Receives inbound messages and delivery/read/failure statuses through webhooks.
- Stores idempotency records in Netlify Blobs so a repeated click/run does not duplicate a send.
- Automatically marks inbound contacts as `customer_initiated` in the WhatsApp event store.

## Required Netlify environment variables

Set these in the Netlify site environment. Do not commit secrets.

- `WHATSAPP_ACCESS_TOKEN` — Meta system-user access token with WhatsApp messaging permissions.
- `WHATSAPP_PHONE_NUMBER_ID` — the Cloud API phone-number ID.
- `WHATSAPP_GRAPH_VERSION` — current Graph API version, e.g. the version shown in your Meta app dashboard.
- `WHATSAPP_VERIFY_TOKEN` — a random secret string you choose for webhook verification.

Recommended for setup/operations outside this app:

- `WHATSAPP_WABA_ID` — WhatsApp Business Account ID.

## Meta setup

1. In Meta Business / Developer dashboard, add the WhatsApp product and connect a WhatsApp Business Account and business phone number.
2. Create a long-lived system-user access token with the WhatsApp messaging permission.
3. Deploy this app to Netlify.
4. Set the webhook callback URL to:
   `https://YOUR-SITE.netlify.app/api/webhook`
5. Use the exact `WHATSAPP_VERIFY_TOKEN` value as the webhook verify token.
6. Subscribe the app to the WABA so message/status events are delivered to the webhook.
7. Create/approve any templates needed for business-initiated messaging outside the customer-service window.

## Operating model

`LinkedIn/social outreach → prospect opts in / initiates WhatsApp → queue becomes WhatsApp-eligible → automated message/PDF → webhook tracks delivery/reply → tracker updates → follow-up.`

For contacts without WhatsApp eligibility, keep the queue item in HOLD and continue through LinkedIn/email instead of forcing a WhatsApp send.

## API

### GET `/api/queue`
Returns current queue items.

### POST `/api/queue`
Creates/updates a queue item.

### POST `/api/send`
Modes:

- `text`
- `document`
- `template`

All sends require `whatsappEligibility` of `opted_in` or `customer_initiated`.

### GET/POST `/api/webhook`
Meta verification and event ingestion endpoint.

## PDF delivery

The first version accepts either a Meta media ID or a public HTTPS PDF URL. The next integration target is automatic publication of approved Revenue Recovery PDFs to a controlled public asset location before the send step, eliminating manual file handling.
