# ChatGPT → GitHub → Buffer → LinkedIn PDF lane

## Purpose

This lane removes the manual hosting step for LinkedIn PDF/document carousels produced in ChatGPT while preserving exact media bytes and the existing owner approval controls.

A finished PDF can enter through either of two mutually exclusive transports:

1. ordered repository-safe base64 text chunks plus one manifest; or
2. a temporary public HTTPS binary bridge plus a manifest containing the locked expected SHA-256.

Both routes converge on the same governed intake. The workflow reconstructs or downloads the exact PDF, verifies its signature, byte count and SHA-256, reads the page count, generates a first-page thumbnail, promotes the media into the governed LinkedIn review area, and creates or updates the locked queue revision.

The lane does **not** publish merely because media is ingested. Public Buffer mutation remains controlled by the existing repository-owner `[APPROVED LINKEDIN]` / `[APPROVED LINKEDIN WEEK]` gate.

## End-to-end flow

1. ChatGPT identifies the final LinkedIn PDF and verifies that it is the intended revision.
2. ChatGPT computes and locks the source PDF SHA-256.
3. Choose exactly one transport:
   - **Chunk transport:** base64-encode the PDF, split it into repository-safe `.b64` chunks, commit the chunks first, then commit the manifest last.
   - **HTTPS binary bridge:** obtain a temporary public HTTPS download URL for the exact PDF and place that URL plus the mandatory locked `expectedSha256` in the manifest. The temporary URL is transport only and is never promoted as the canonical media URL.
4. Commit the manifest at `media-staging/pdf-intake/<post-id>/manifest.json`.
5. `.github/workflows/linkedin-pdf-intake.yml` starts automatically from the manifest commit.
6. `scripts/linkedin-pdf-intake.cjs`:
   - requires exactly one transport, `chunks` or `downloadUrl`
   - reconstructs or downloads the original PDF
   - refuses non-PDF bytes
   - enforces the 100 MB document ceiling
   - requires SHA-256 for HTTPS bridge transport and verifies the exact digest
   - rejects non-HTTPS URLs, embedded URL credentials, localhost and private-address targets
   - follows HTTPS redirects only
   - reads and caps page count at 300
   - renders a JPEG thumbnail from page 1
   - stores the promoted package under `apps/linkedin-review/media/intake/<post-id>/`
   - creates stable public `raw.githubusercontent.com` URLs
   - creates or updates the queue candidate as `status: review`
   - redacts the temporary bridge URL from audit output and never writes it into the queue
7. The workflow runs PDF intake tests and existing media-preflight tests before committing the promoted media and queue revision.
8. The workflow re-downloads the public raw PDF and thumbnail, verifies the promoted PDF hash again, and then opens or updates a `[PDF INTAKE READY]` audit issue.
9. Human/repository-owner approval remains mandatory.
10. Once explicitly approved, the existing `linkedin-buffer-autopost.yml` path performs media preflight, capacity checks, revision/fingerprint checks and Buffer scheduling.
11. Existing publication verification later proves sent/error/unknown state independently of Buffer acceptance.

## Manifest schema

### Base64 chunk transport

```json
{
  "schemaVersion": 1,
  "id": "tte-li-cold-enquiries-001",
  "revision": 1,
  "title": "How to fix cold enquiries and ghost clients",
  "documentTitle": "How to Fix Cold Enquiries & Ghost Clients",
  "category": "buyer_diagnostics",
  "funnelStage": "mof",
  "targets": ["personal"],
  "mode": "draft",
  "copy": {
    "default": "LinkedIn caption here"
  },
  "mediaAlt": "Nine-page 222Emails carousel explaining how service businesses can recover cold enquiries and ghost clients.",
  "expectedSha256": "<64-character lowercase sha256>",
  "chunks": [
    "media-staging/pdf-intake/tte-li-cold-enquiries-001/part-001.b64",
    "media-staging/pdf-intake/tte-li-cold-enquiries-001/part-002.b64"
  ]
}
```

### HTTPS binary bridge transport

```json
{
  "schemaVersion": 1,
  "id": "tte-li-cold-enquiries-001",
  "revision": 1,
  "title": "How to fix cold enquiries and ghost clients",
  "documentTitle": "How to Fix Cold Enquiries & Ghost Clients",
  "category": "buyer_diagnostics",
  "funnelStage": "mof",
  "targets": ["secondary"],
  "mode": "schedule",
  "copy": {
    "default": "LinkedIn caption here"
  },
  "mediaAlt": "LinkedIn PDF carousel.",
  "expectedSha256": "<64-character lowercase sha256>",
  "downloadUrl": "https://temporary-public-https-file-url.example/document.pdf",
  "scheduledAt": {
    "secondary": "2026-09-09T08:45:00+01:00"
  }
}
```

`chunks` and `downloadUrl` are mutually exclusive. `expectedSha256` is mandatory when `downloadUrl` is used.

For a directly scheduled candidate, set `"mode": "schedule"` and include an ISO timestamp for every target. Schedule data entering the queue is still not approval to publish. The owner approval issue must exactly match the locked queue revision.

## ChatGPT operator contract

When a user says, in substance, “schedule this PDF on LinkedIn”, the preferred path is:

1. Verify the final PDF exists and is the intended revision.
2. Derive caption, document title, destination and explicit future schedule from the user's instruction/context.
3. Measure page count and byte count and compute the original PDF SHA-256.
4. Use the HTTPS bridge for large exact PDFs when a connected file-transfer action can provide a temporary public HTTPS URL. Otherwise use deterministic ordered base64 chunks.
5. Commit all chunks before the manifest when using chunk transport. For HTTPS transport, commit only the manifest after the real bridge URL is available.
6. Wait for the PDF intake workflow result and verify `[PDF INTAKE READY]` evidence.
7. Verify the public raw GitHub PDF returns the expected hash and the queue revision carries the exact caption, media, target and schedule.
8. Only when the user's instruction constitutes explicit approval, create the exact owner `[APPROVED LINKEDIN]` record used by the current release workflow.
9. Verify Buffer acceptance and report it as scheduled/accepted, never as published.
10. Publication becomes true only when the existing verifier records sent evidence after due time.

## Safety invariants

- No binary is pasted into an issue.
- No API key is placed in repository content.
- Temporary transport URLs are not canonical media URLs and are not written into the queue.
- HTTPS bridge transport requires the exact locked SHA-256 before download.
- Bridge transport rejects HTTP, URL credentials, localhost and private-address targets.
- Redirects are constrained to HTTPS.
- Chunks are transport only. The reconstructed PDF hash is the source-of-truth proof.
- Stale revisions fail closed.
- Invalid, oversized or non-PDF input fails closed.
- A changed promoted PDF hash fails media preflight.
- The lane does not change Buffer recurring schedules.
- The lane does not move already scheduled posts.
- The lane does not bypass capacity, idempotency, content QA or publication verification.

## Stable hosting decision

The repository is public, so promoted PDF assets use stable HTTPS raw GitHub URLs. GitHub may serve raw PDFs as `application/octet-stream`; the hardened preflight allows that **only** for `raw.githubusercontent.com` `.pdf` URLs and still requires a `%PDF-` file signature plus the locked byte/hash checks. Other document hosts continue to require `application/pdf`.

## Current implementation files

- `.github/workflows/linkedin-pdf-intake.yml`
- `scripts/linkedin-pdf-intake.cjs`
- `tests/linkedin-pdf-intake.test.cjs`
- `scripts/linkedin-media-preflight.cjs`
- `tests/linkedin-media-preflight.test.cjs`
- `apps/linkedin-review/queue.json`
- `.github/workflows/linkedin-buffer-autopost.yml`

## Definition of complete

The PDF lane is operational when a final ChatGPT PDF can enter by one approved transport, the workflow promotes and verifies the exact bytes, the queue contains the exact locked revision, the existing owner approval path can send that revision to Buffer, Buffer returns an accepted post ID, and the publication verifier can later prove the LinkedIn outcome without any manual external media hosting.
