# 222Emails LinkedIn PDF Carousel Publishing Workflow | CANONICAL VERIFIED v1.0.1

**Operating status:** canonical reusable production route  
**Hardening date:** 6 September 2026  
**Owner:** Chelston / 222Emails  
**Repository:** `Chelston222/CGPT-1`

> For any 222Emails LinkedIn document post, PDF carousel, PDF packaging, governed PDF intake, Buffer scheduling or publication-verification task, use this pathway by default unless Chelston explicitly replaces it. Do not invent a parallel production route.

## 1. Canonical architecture

```text
Approved final PDF + approved final caption
  -> authorised Gmail transport from tripletwochelston@gmail.com
  -> hello@222emails.com
  -> PrivateEmail IMAP
  -> exact sender/subject/filename/bytes/SHA verification
  -> revision-scoped GitHub media promotion
  -> immutable Git-commit PDF and thumbnail pin
  -> governed GitHub LinkedIn queue
  -> optional live Notion defence-in-depth when GitHub credential exists
  -> repository-owner [APPROVED LINKEDIN] gate
  -> exact current-queue fingerprint verification
  -> remote media and Buffer capacity preflight
  -> optional final pre-mutation Notion recheck when credentialed
  -> durable Buffer dispatch intent
  -> Buffer createPost
  -> durable Buffer acceptance ledger
  -> LinkedIn
  -> separate due-time publication verifier
```

Use these states precisely:

1. `exact media verified`
2. `queued in governed GitHub layer`
3. `owner approved`
4. `accepted/scheduled by Buffer`
5. `publication verified`

Never call a post published merely because Gmail sent the message, IMAP found the attachment, GitHub promoted the PDF, the owner approved it, or Buffer accepted it.

## 2. Trigger scope

Use this workflow automatically for:

- LinkedIn document posts
- LinkedIn PDF carousels
- packaging approved carousel pages into a LinkedIn PDF
- moving a completed PDF into governed publishing
- Buffer scheduling for a governed LinkedIn document
- recovery of a failed PDF intake or Buffer release
- checking whether a governed PDF is ready, queued, scheduled or published
- updating the LinkedIn Content Calendar for one of these releases

Only depart from this route when Chelston explicitly requests another method or a verified platform constraint makes it impossible.

## 3. Authority model

The minimum production authority is:

```text
current governed queue revision
+ exact repository-owner approval matching that revision
+ exact release fingerprint
+ mandatory Buffer credential
```

Live Notion validation is a defence-in-depth layer when GitHub has `NOTION_API_KEY`. When available, the workflow checks the exact source page during release planning and again immediately before the provider write.

When that GitHub secret is absent, the workflow does not fail merely because machine Notion access is unavailable. It explicitly records:

```text
owner-approved-current-queue-no-notion-secret
```

and relies on the exact current-queue fingerprint plus repository-owner approval. It must never claim that Notion was live-checked in this mode.

This distinction is deliberate. The proven publishing lane must not become unusable because an optional defence credential is absent, while the audit must remain truthful about which checks actually ran.

If live Notion revocation must be enforced as a machine stop, configure and verify the GitHub Notion credential. Without it, a change made only in Notion is not guaranteed to revoke an already matching GitHub approval. To revoke release in no-secret mode, withdraw/close the approval or create a changed governed queue revision that invalidates the existing approval fingerprint.

## 4. Canonical repository surfaces

```text
.github/workflows/linkedin-imap-pdf-intake.yml
.github/workflows/linkedin-buffer-autopost.yml
.github/workflows/linkedin-buffer-intent-reconcile.yml
.github/workflows/linkedin-publication-verifier.yml
.github/workflows/linkedin-notion-preflight.yml
.github/workflows/linkedin-pdf-workflow-ci.yml
scripts/linkedin-imap-intake-config.cjs
scripts/linkedin-imap-intake-from-issue.mjs
scripts/linkedin-imap-pdf-intake.mjs
scripts/linkedin-pdf-intake.cjs
scripts/linkedin-media-preflight.cjs
scripts/linkedin-notion-quality-gate.cjs
scripts/linkedin-buffer-acceptance-ledger.cjs
scripts/linkedin-buffer-capacity.cjs
scripts/linkedin-review-core.cjs
scripts/linkedin-week-batch.cjs
apps/linkedin-review/queue.json
apps/linkedin-review/media/intake/<post-id>/r<revision>/
tests/linkedin-imap-intake-config.test.cjs
tests/linkedin-imap-mime-resilience.test.cjs
tests/linkedin-pdf-intake.test.cjs
tests/linkedin-pdf-replay-preservation.test.cjs
tests/linkedin-media-preflight.test.cjs
tests/linkedin-notion-quality-gate.test.cjs
tests/linkedin-buffer-acceptance-ledger.test.cjs
tests/linkedin-hardening-static.test.cjs
docs/LINKEDIN_PDF_INTAKE.md
docs/LINKEDIN_BUFFER_AUTOPOST_SETUP.md
```

The historical `.github/workflows/linkedin-pdf-intake.yml` direct-repository route and `.github/workflows/linkedin-pdf-share-now.yml` immediate route are retired. They must not reconstruct, schedule or publish a PDF.

## 5. Production and packaging gate

Before transport, the PDF and caption must already be final.

Carousel production inherits the 222Emails rules:

- use the selected Full, Preview First or Fast Batch mode for new multi-image work
- run sequential red-team and verification passes
- generate one standalone page at a time
- no collage
- no merged contact sheet as a deliverable
- visually QA each final page
- lock approved pages before packaging
- package without unnecessary additional loss
- use UK English
- no em dash
- no invented proof, metrics or claims

For PDF packaging:

- use approved source page assets
- preserve native dimensions and aspect ratio where practical
- use one source image per PDF page
- avoid unnecessary resampling or lossy recompression
- verify page count, page order, orientation and cover
- verify mobile readability
- verify caption-to-asset pairing
- verify the PDF opens correctly
- retain original source pages where practical

Record the exact:

```text
filename
byte count
page count
SHA-256
```

Changed media bytes, caption, schedule, destination or other locked release material require a higher revision.

## 6. Public archival boundary

The current canonical media host is the public `raw.githubusercontent.com` surface of the public `Chelston222/CGPT-1` repository.

The governed GitHub issue and queue also expose release metadata such as the caption, schedule, title, target, Notion source URL and media identity. Git history may preserve material after later changes.

Therefore this route is only for material that is safe to place in a public repository before publication and safe to remain in public repository history afterwards.

Every canonical intake manifest must explicitly contain:

```json
"publicMediaApproved": true,
"publicReleaseMaterialApproved": true
```

Do not use this route for confidential, embargoed, private or commercially sensitive material that must remain secret before publication.

A private capability-based media route may be adopted later, but it is not canonical until its Buffer PDF ingestion path is separately proven and approved.

## 7. Notion operating record and optional live defence

Use the existing TTE LinkedIn Content Calendar. The concrete Notion page URL becomes the queue `sourceUrl`.

A governed PDF row should remain operationally aligned with:

- page active, not archived or trashed
- `Content Decision = Keep`
- `Approval = Approved`
- `Anti-DNA | Pass = checked`
- `Asset Ready = checked`
- `Automation Ready = checked`
- `Automation Status` automation-capable and not `Manual` for automated PDF release
- `Buffer Status` in a permitted release state
- `Final Copy` matching the locked queue caption
- `Publish Payload` matching the locked queue caption
- exactly one governed target
- exactly one locked target schedule
- `Scheduled At` representing the same instant as the locked queue schedule

When `NOTION_API_KEY` exists in GitHub, the live gate checks all of the above against the exact source page twice:

1. during release planning
2. immediately before each dispatch intent and Buffer provider write

The second check closes the practical time-of-check/time-of-use gap if the source row is revoked while capacity or media preflight is running.

When `NOTION_API_KEY` is absent, `.github/workflows/linkedin-notion-preflight.yml` reports:

```text
SKIPPED_NO_SECRET
OPTIONAL_DEFENCE_UNAVAILABLE
EXACT_CURRENT_QUEUE_PLUS_REPOSITORY_OWNER_APPROVAL
```

and succeeds. Production then uses the owner-approved current queue fallback. It must not label this as `live-notion`.

After confirmed Buffer acceptance, update the matching Notion row with the Buffer ID and queued state. Do not mark Published until publication verification succeeds.

## 8. Authorised email transport

Send the exact final PDF:

```text
FROM: tripletwochelston@gmail.com
TO: hello@222emails.com
SUBJECT: TTE LINKEDIN PDF INTAKE <id>
ATTACHMENT: <exact final PDF filename>
```

The email is transport only. It grants no publication authority.

The bridge scans selectable mailboxes in the recent 72-hour window and excludes Sent, Drafts, Trash and Junk special-use mailboxes.

Mail clients can label a genuine PDF as `application/pdf` or a generic binary type. MIME labelling is not authoritative. Selection uses the exact filename followed by exact byte count, `%PDF-` signature and locked SHA-256.

## 9. Governed intake issue

Create the issue as the repository owner.

Title:

```text
[IMAP PDF INTAKE] <id>
```

Body:

```html
<!-- INTAKE_CONFIG_START -->
{
  "id": "<id>",
  "expectedSubject": "TTE LINKEDIN PDF INTAKE <id>",
  "expectedSender": "tripletwochelston@gmail.com",
  "expectedFilename": "<exact filename.pdf>",
  "expectedSha256": "<64-character SHA-256>",
  "expectedBytes": 12345678,
  "expectedPages": 10,
  "manifest": {
    "schemaVersion": 1,
    "id": "<id>",
    "revision": 1,
    "title": "<single-line post title>",
    "documentTitle": "<single-line LinkedIn document title>",
    "category": "buyer_diagnostics",
    "funnelStage": "mof",
    "targets": ["secondary"],
    "mode": "schedule",
    "scheduledAt": {
      "secondary": "<ISO 8601 timestamp with Z or explicit UTC offset>"
    },
    "copy": {
      "default": "<exact approved caption>"
    },
    "mediaAlt": "<carousel description>",
    "expectedSha256": "<same exact SHA-256>",
    "publicMediaApproved": true,
    "publicReleaseMaterialApproved": true,
    "sourceUrl": "https://app.notion.com/<concrete-page-id>"
  }
}
<!-- INTAKE_CONFIG_END -->
```

Do not supply `downloadUrl` or `chunks` in this owner issue. The verified IMAP attachment creates the internal chunks.

## 10. Intake validation contract

Fail closed unless all relevant conditions pass:

- repository-owner issue
- exact `[IMAP PDF INTAKE] ` title prefix
- title ID equals `config.id`
- exactly one locked config block
- exact sender `tripletwochelston@gmail.com`
- exact subject `TTE LINKEDIN PDF INTAKE <id>`
- ordinary PDF filename with no path separators or control characters
- expected SHA-256 is valid
- expected bytes are 1 to 100,000,000
- expected pages are 1 to 300
- schema version exactly 1
- revision is an explicit positive integer
- title and document title are single-line header-safe values
- category and funnel stage, when supplied, are header-safe slugs
- `copy.default` is the only copy variant
- caption is 1 to 3,000 characters
- caption contains no em dash
- caption contains no reserved `---PERSONAL---`, `---MAIN---` or `---SECONDARY---` target section marker, including whitespace-padded forms
- exactly one target exists and it is `personal`, `main` or `secondary`
- exactly one schedule key exists and it matches the single target
- mode is `schedule`
- schedule contains `Z` or an explicit UTC offset
- schedule is more than ten minutes in the future at intake
- schedule is no more than 90 days ahead
- public media acknowledgement is true
- public release-material acknowledgement is true
- manifest SHA matches the transport SHA
- source URL contains a concrete Notion page ID
- issue config does not supply a download URL or chunks

The 90-day scheduling ceiling gives margin inside the current 120-day publication-verifier approval horizon.

## 11. Exact attachment retrieval

An attachment candidate is not trusted just because sender, subject and filename look correct.

For each matching candidate the bridge verifies:

```text
exact filename
exact byte count
%PDF- signature
exact SHA-256
```

Only a fully matching candidate is selected. Lookalike messages and attachments fail closed.

The selected PDF is staged into deterministic 2,000,000-byte base64 chunks for internal reconstruction.

## 12. Reconstruction and revision safety

The verified bytes are reconstructed under:

```text
apps/linkedin-review/media/intake/<id>/r<revision>/
```

The queue update rules are:

- identical same revision: idempotent replay
- changed same revision: fail closed
- changed locked release: strictly higher revision required

### Replay byte preservation

An idempotent replay must not silently replace already-governed media with newly rendered equivalents.

Before regeneration, the intake snapshots the existing governed PDF and thumbnail when present. After the incoming PDF identity and stable queue fingerprint prove an identical replay, the previously governed PDF and thumbnail bytes are restored exactly before any commit decision.

Replay fails closed if the previous governed files are missing or if the existing governed PDF no longer matches the locked byte count and SHA-256.

This prevents renderer-version drift from mutating a locked same revision.

## 13. Concurrency safety

The intake uses a global GitHub Actions concurrency group and also defends against `main` advancing while a run is active.

Before each queue/media push it:

1. fetches current `origin/main`
2. resets to that latest state
3. rebuilds the deterministic queue/media mutation
4. verifies the locked pages, bytes, SHA, ID and revision again
5. attempts the push
6. if `main` advanced, refreshes and retries
7. fails after the bounded retry count rather than forcing stale state

Never blindly rebase or force a stale `queue.json` snapshot into production.

## 14. Immutable media pin

After the media package exists on GitHub, the queue media URLs are pinned to a full 40-character Git commit SHA that already contains the promoted PDF and thumbnail.

Canonical media paths are:

```text
https://raw.githubusercontent.com/<owner>/<repo>/<40-char-commit>/apps/linkedin-review/media/intake/<id>/r<revision>/<id>.pdf
https://raw.githubusercontent.com/<owner>/<repo>/<40-char-commit>/apps/linkedin-review/media/intake/<id>/r<revision>/thumbnail.jpg
```

The PDF and thumbnail must use the same immutable commit.

The workflow then downloads those public URLs and verifies:

- PDF exact byte count
- PDF exact SHA-256
- PDF page count
- PDF file signature/type
- thumbnail exact byte count against the promoted local thumbnail
- thumbnail exact SHA-256 against the promoted local thumbnail
- thumbnail image type

## 15. Exact-media readiness proof

A successful intake creates or refreshes:

```text
[PDF INTAKE READY] <id>@<revision>
```

The proof includes:

- queue item and revision
- pages
- bytes
- SHA-256
- immutable media commit
- PDF URL
- thumbnail URL
- source mailbox
- source UID
- replay state

This means `exact media verified` and `queued in governed GitHub layer`.

It does not mean approved or published.

## 16. Repository-owner publication approval

Only after immutable exact-media readiness exists should the owner create:

```text
[APPROVED LINKEDIN] <id>@<revision>
```

Canonical body:

```text
POST_ID: <id>
REVISION: <revision>
CATEGORY: <category>
TARGETS: <single target>
MODE: schedule
CONTENT_QA: PASS
SCHEDULE_AT: <ISO 8601 timestamp with Z or explicit UTC offset>
MEDIA_URL: <immutable commit-pinned PDF URL>
MEDIA_KIND: document
DOCUMENT_TITLE: <document title>
DOCUMENT_THUMBNAIL_URL: <immutable commit-pinned thumbnail URL>
DOCUMENT_PAGE_COUNT: <page count>
MEDIA_BYTES: <exact bytes>
MEDIA_SHA256: <exact SHA-256>
---
<exact final caption>
```

The approval must exactly match the current locked queue revision. Legacy issue-only dispatch is disabled.

## 17. Buffer release safety

All production Buffer releases share:

```text
linkedin-buffer-capacity-release
```

The surviving release run drains the full eligible open approval queue under that lock.

`BUFFER_API_KEY` is mandatory. Missing Buffer credentials fail closed.

Before the first Buffer provider mutation the workflow validates:

- current locked queue revision
- exact owner approval fingerprint
- optional live Notion state when credentialed
- Buffer credentials
- Buffer capacity
- schedule freshness
- daily placement rules
- exact remote media integrity

Immediately before each individual provider write it validates schedule freshness again. If `NOTION_API_KEY` exists, it also performs the second live Notion check. If the secret is absent, the exact current-queue plus owner-approval authority remains in force and the audit records the no-secret mode.

## 18. Durable dispatch intent and acceptance ledger

Every placement has a stable key:

```text
<post-id>@<revision>:<target>
```

Before the Buffer write, a trusted bot marker is written:

```text
<!-- BUFFER_DISPATCH_INTENT <placement-key> -->
```

After Buffer returns a post ID, the durable ledger is written first:

```text
<!-- BUFFER_ACCEPTED <placement-key> bufferId=<buffer-id> dueAt=<iso> -->
```

The acceptance is then mirrored onto the source approval issue.

Trusted ledger discovery accepts a ledger created by either the repository owner or `github-actions[bot]`. More than one trusted ledger is split-brain state and fails closed.

A previously accepted placement key is idempotent and is not recreated.

## 19. Uncertain Buffer-write recovery

If a process dies after dispatch intent but before acceptance is durably recorded, automatic recreation stops.

Use the owner-gated issue trigger:

```text
[RECONCILE LINKEDIN BUFFER INTENTS]
```

The reconciler uses the same release lock and performs Buffer reads only. It never creates, edits or deletes a Buffer post.

It reconstructs the locked placement and searches a bounded provider window around its due time. It can recover an exact provider record in `scheduled`, `sent` or `error` state only when exactly one match has:

- target channel
- exact due instant
- exact caption digest
- exact media asset `source` URL for media posts, or no media asset for text-only posts

Zero or multiple matches remain blocked for explicit review.

This also means an unresolved intent can still be safely reconciled after its scheduled due time rather than becoming permanently unrecoverable once it leaves Buffer's scheduled inventory.

## 20. Buffer acceptance semantics

A Buffer post ID proves provider acceptance.

Call that state:

```text
accepted/scheduled by Buffer
```

Do not call it:

```text
published
```

If the durable ledger accepted the placement but the acceptance comment on the approval issue was lost, publication verification can recover the Buffer ID from the trusted durable ledger by mapping the trusted dispatch-intent key back to exactly one governed approval issue.

## 21. Publication verification

Publication verification is separate and read-only toward Buffer.

The verifier scans the supported recent approval horizon and queries exact accepted Buffer post IDs.

Only:

```text
Buffer status = sent
AND sentAt exists
```

becomes:

```text
publication verified
```

Provider `error` becomes publication failed.

A post unresolved more than 30 minutes after due time is UNKNOWN/pending and must not be counted as published.

PDF analytics retain a native LinkedIn check when Buffer does not expose sufficient document-post metrics.

## 22. Failure recovery rule

When a stage fails:

1. identify the exact failed stage
2. preserve its audit evidence
3. diagnose the actual failure
4. repair that stage
5. retry that stage
6. continue only after it passes

Do not skip ahead.

Do not create a second unofficial publishing route because a gate failed.

If locked release material changes, use a new revision rather than pretending the old fingerprint still represents the asset.

## 23. Fail-closed invariants

- no direct ChatGPT-to-Buffer dependency is required
- no production PDF release without exact repository-owner approval
- no owner approval before immutable exact-media proof
- no silent media mutation after revision lock
- exact SHA-256, bytes and pages remain authoritative
- same-revision replay preserves previously governed media bytes
- future canonical PDF and thumbnail URLs are commit-pinned, not mutable `main` URLs
- PDF and thumbnail pins resolve to the same immutable commit
- canonical intake has one target, one matching schedule key and only `copy.default`
- canonical schedule is within 90 days
- `BUFFER_API_KEY` is mandatory
- missing optional Notion machine access is explicit and must never be misreported as a live gate pass
- when Notion credential exists, a failing live gate blocks release and is rechecked immediately before provider write
- archived or trashed Notion source pages block release when live Notion defence is active
- `Automation Status = Manual` blocks automated governed PDF release when live Notion defence is active
- unresolved Buffer dispatch intent blocks recreation until positively reconciled
- reconciler is read-only toward Buffer
- trusted durable-ledger split-brain state fails closed
- public media and public release metadata require explicit acknowledgement
- preserve audit history
- never equate email sent, IMAP found, GitHub queued, owner approved or Buffer accepted with LinkedIn published
- do not use retired direct-repository or share-now PDF routes

## 24. Proven Retention School reference run

These three releases proved the earlier canonical path before the last hardening layers were added. They are valid production evidence for exact PDF intake and Buffer document acceptance, but they are not evidence that every later v1.0.1 replay, immutable-pin, dispatch-intent or optional-Notion protection was exercised by these already scheduled posts.

```text
Part 1
ID: rs-li-retention-school-part-1
Pages: 10
Bytes: 3,562,430
SHA-256: cd8dc92f4dbfb6adf7706dbb08aa1acc329fe770d71a0cdc706df91617bd422f
Buffer ID: 6a9d238a6aba27483202f89a
Due: 11 September 2026, 08:45 BST
Buffer state at hardening time: accepted/scheduled

Part 2
ID: rs-li-retention-school-part-2
Pages: 10
Bytes: 22,244,922
SHA-256: 653432b489b7df73e1bcf52b78c413b2dc14517c8ee65ffdf96eb5f038b27b66
Buffer ID: 6a9d25c8fd1c461b0090193b
Due: 14 September 2026, 08:45 BST
Buffer state at hardening time: accepted/scheduled

Part 3
ID: rs-li-retention-school-part-3
Pages: 10
Bytes: 16,934,427
SHA-256: 65a74d59078008c23c6a3c9a905e25ff16924ff5bfbfa73149f31470242cf609
Buffer ID: 6a9d2cf141e2718ea379a7a9
Due: 16 September 2026, 08:45 BST
Buffer state at hardening time: accepted/scheduled
```

Batch totals:

```text
PDFs: 3
Pages: 30
Bytes: 42,741,779
Exact-media intakes passed: 3/3
Buffer destinations accepted: 3/3
Queue-slot waits: 0
```

None of these releases should be called published until the due-time verifier produces positive `sent` evidence.

## 25. Operator checklist

### Packaging

- [ ] final copy approved
- [ ] final visuals approved
- [ ] correct page order
- [ ] no collage
- [ ] mobile readability checked
- [ ] no em dash
- [ ] claims verified
- [ ] exact PDF opens
- [ ] page count recorded
- [ ] bytes recorded
- [ ] SHA-256 recorded

### Source and intake

- [ ] Notion source row exists and is aligned with the intended release
- [ ] target is singular and correct
- [ ] schedule has an explicit offset or `Z`
- [ ] schedule is more than ten minutes away and within 90 days
- [ ] release material is safe for public GitHub archival
- [ ] exact filename locked
- [ ] email sent from authorised Gmail
- [ ] exact subject used
- [ ] exact PDF attached
- [ ] owner intake issue created
- [ ] public-media acknowledgement true
- [ ] public-release-material acknowledgement true

### GitHub proof

- [ ] intake workflow passed
- [ ] exact pages/bytes/SHA passed
- [ ] replay handling passed where applicable
- [ ] revision-scoped media exists
- [ ] PDF and thumbnail are pinned to one immutable commit
- [ ] public PDF and thumbnail verification passed
- [ ] `[PDF INTAKE READY]` proof exists

### Approval and Buffer

- [ ] owner `[APPROVED LINKEDIN]` issue exactly matches locked queue
- [ ] Buffer credential available
- [ ] quality mode explicitly reports either `live-notion` or the no-secret owner-queue fallback
- [ ] if live Notion is available, planning gate passed
- [ ] media preflight passed
- [ ] if live Notion is available, final pre-mutation gate passed
- [ ] durable dispatch intent exists
- [ ] Buffer acceptance returned a post ID
- [ ] durable acceptance ledger contains the placement
- [ ] source approval contains acceptance evidence or durable fallback exists
- [ ] Notion row updated to queued state and Buffer ID where applicable

### After due time

- [ ] publication verifier ran
- [ ] Buffer reported `sent` with `sentAt`
- [ ] only then call it publication verified

## 26. Reuse command

Attach this file to a new chat and say:

```text
Use the attached 222Emails LinkedIn PDF Carousel Publishing Workflow CANONICAL VERIFIED v1.0.1 as canonical.
Take this LinkedIn PDF from its current state through the governed route.
Do not invent a parallel upload or immediate-publish method.
Preserve exact-media verification, replay byte preservation,
immutable commit-pinned PDF and thumbnail media,
exact current-queue fingerprinting and repository-owner approval,
optional live Notion defence with a final pre-mutation recheck when configured,
durable Buffer dispatch-intent and acceptance proof,
read-only exact-match intent reconciliation,
and separate publication verification with durable-ledger fallback.
If the GitHub Notion credential is absent, report the owner-approved current-queue fallback explicitly and do not pretend Notion was live-checked.
Diagnose and repair a failed stage rather than skipping it.
Return only verified status.
```

## 27. Stopping rule for future architecture changes

Do not continuously refactor a healthy production workflow for style alone.

Re-open architecture hardening when one of these occurs:

- a real production failure
- a provider/API behaviour change
- a new confidentiality requirement
- a new destination or posting mode that the current contract cannot represent safely
- a material security, idempotency or integrity defect found by regression testing

Otherwise preserve the canonical route and improve through tests rather than parallel systems.

**This is the default governed 222Emails LinkedIn PDF/document publishing route until Chelston explicitly replaces it.**
