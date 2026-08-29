# ChatGPT → GitHub → Buffer → LinkedIn PDF lane

## Purpose

This lane removes the manual hosting step for LinkedIn PDF/document carousels produced in ChatGPT.

A finished PDF is transported into the repository as ordered base64 text chunks plus one manifest. The PDF intake workflow reconstructs the exact bytes, verifies the PDF, measures its byte count and SHA-256, reads the page count, generates a first-page thumbnail, promotes the media into the governed LinkedIn review area, and creates or updates the locked queue revision.

The lane does **not** publish merely because media is ingested. Public Buffer mutation remains controlled by the existing repository-owner `[APPROVED LINKEDIN]` / `[APPROVED LINKEDIN WEEK]` gate.

## End-to-end flow

1. ChatGPT creates the final LinkedIn PDF.
2. ChatGPT computes the source PDF SHA-256.
3. ChatGPT base64-encodes the PDF and splits the base64 into repository-safe text chunks.
4. Chunks are committed under `media-staging/pdf-intake/<post-id>/` with `.b64` extensions.
5. The manifest is committed **last** at `media-staging/pdf-intake/<post-id>/manifest.json`.
6. `.github/workflows/linkedin-pdf-intake.yml` starts automatically from the manifest commit.
7. `scripts/linkedin-pdf-intake.cjs`:
   - reconstructs the original PDF
   - refuses non-PDF bytes
   - enforces the 100 MB document ceiling
   - verifies optional locked SHA-256
   - reads and caps page count at 300
   - renders a JPEG thumbnail from page 1
   - stores the promoted package under `apps/linkedin-review/media/intake/<post-id>/`
   - creates stable public `raw.githubusercontent.com` URLs
   - creates/updates the queue candidate as `status: review`
8. The workflow runs PDF intake tests and existing media-preflight tests before committing the promoted media and queue revision.
9. The workflow re-downloads the public raw PDF and thumbnail, verifies the promoted PDF hash again and then opens/updates a `[PDF INTAKE READY]` audit issue.
10. Human/repository-owner approval remains mandatory.
11. Once explicitly approved, the existing `linkedin-buffer-autopost.yml` path performs media preflight, capacity checks, revision/fingerprint checks and Buffer scheduling.
12. Existing publication verification later proves sent/error/unknown state independently of Buffer acceptance.

## Manifest schema

Example:

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

For a directly scheduled candidate, set `"mode": "schedule"` and include an ISO timestamp for every target:

```json
"scheduledAt": {
  "personal": "2026-09-01T16:30:00+01:00"
}
```

Schedule data entering the queue is still not approval to publish. The owner approval issue must exactly match the locked revision.

## ChatGPT operator contract

When a user says, in substance, “schedule this PDF on LinkedIn”, the preferred path is:

1. Verify the final PDF exists and is the intended revision.
2. Derive caption, document title, destination and explicit future schedule from the user's instruction/context.
3. SHA-256 the original PDF.
4. Split base64 into chunks small enough for the GitHub contents API. Use deterministic numbered filenames and create all chunks before the manifest.
5. Commit the manifest last.
6. Wait for the PDF intake workflow result and verify `[PDF INTAKE READY]` evidence.
7. Verify the public PDF URL returns the expected hash and the queue revision carries the exact caption/media/schedule.
8. Only when the user's instruction constitutes explicit approval, create the exact owner `[APPROVED LINKEDIN]` record used by the current release workflow.
9. Verify Buffer acceptance and report it as scheduled/accepted, never as published.
10. Publication becomes true only when the existing verifier records sent evidence after due time.

## Safety invariants

- No binary is pasted into an issue.
- No API key is placed in repository content.
- Chunks are transport only. The reconstructed PDF hash is the source-of-truth proof.
- Stale revisions fail closed.
- Invalid/oversized/non-PDF input fails closed.
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

The PDF lane is operational when a final ChatGPT PDF can be chunked and manifested, the workflow promotes and verifies it, the queue contains the exact locked revision, the existing owner approval path can send that revision to Buffer, and the publication verifier can later prove the LinkedIn outcome without any manual external media hosting.
