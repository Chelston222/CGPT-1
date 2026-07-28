# HARPER OS

HARPER OS is the 222 Emails control plane for permission-led AI voice outreach, prospect intelligence, call quality, suppression and follow-up orchestration.

## Current architecture

- Responsive management interface
- Netlify Functions backend
- Netlify Blobs persistent storage
- Bearer-token protected management APIs
- Guarded Retell outbound call creation
- Signed Retell webhook ingestion
- Automatic opt-out suppression
- Follow-up webhook handoff
- Truthful readiness health endpoint
- Security headers and safe-mode defaults

## Production endpoints

- `GET /api/health`
- `GET|POST /api/prospects`
- `POST /api/calls`
- `POST /api/retell-webhook`

## Required encrypted environment variables

Copy the names from `.env.example` into the hosting provider's encrypted environment-variable store. Never commit real values.

## Launch gates

HARPER must remain in safe mode unless `/api/health` reports `ready: true`. Live calls additionally require an approved prospect, an opted-in or existing-enquiry permission state, and no suppression match.

## Validation

Run `npm install` followed by `npm run check`. Test the callback journey before enabling any outbound campaign. Verify the Retell webhook signature scheme against the exact Retell account configuration before production use.

## Compliance boundary

The system is deliberately designed for opted-in callbacks and existing enquiries first. It is not a substitute for legal advice or for current TPS/CTPS and PECR compliance review.
