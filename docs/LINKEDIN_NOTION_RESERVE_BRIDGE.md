# 222Emails Content Revenue Flywheel: Notion reserve bridge

## Purpose

This bridge turns an explicitly approved Notion reserve row into a **review-only candidate** for the existing governed GitHub to Buffer lane.

It does not create publication authority. It does not bypass the repository-owner approval issue. It does not publish because a Notion checkbox, learning score or empty Buffer slot exists.

The operating flow is:

**Idea → Build → Approve → Stage exact revision → Repository-owner approval → Buffer capacity release → Publication verification → Learn → Multiply → Revenue**

## Roles

- **Notion** is the content and idea command centre. It stores the caption, exact account identity, schedule, source, revision, media evidence and approval state.
- **GitHub** locks the exact revision, enforces owner authority, preserves idempotency and audit evidence, and runs the existing reliability controls.
- **Buffer** is the delivery queue. Existing free-plan capacity controls remain authoritative.
- **Performance Learning V2** recommends which already eligible content deserves attention. It cannot approve, reschedule or publish.

## Hard authority boundary

A reserve row may be staged only when all recorded release conditions pass, including explicit Notion Approval, Approved for Publish, exact copy/payload match, current visual review date, stable media, supported posting identity and automation readiness.

Even after staging, publication is impossible without a separate repository-owner issue beginning `[APPROVED LINKEDIN]` or `[APPROVED LINKEDIN WEEK]`.

The staging workflow never creates that approval issue itself.

## Media boundary

The private Google Drive `Source URL` is storage and provenance, not a Buffer delivery URL.

Before Buffer release, an approved asset needs a stable provider-reachable `Media URL` that is separate from the private operations repository. Promotion to the media-only delivery surface is a separate consequential action and happens only after the owner has approved that creative for release.

The bridge fetches and hashes the exact media, refuses unsupported or redirected delivery URLs, records byte count and SHA-256, and locks those values into both the GitHub candidate and Notion staging evidence.

## Idempotency and drift

The bridge creates a deterministic fingerprint from the Notion page, post ID, revision, target, schedule, caption, media URL, media bytes, media SHA-256 and alt text.

- Exact replay produces no duplicate candidate.
- A changed payload at the same revision fails closed.
- Replacement requires an incremented Version revision.
- Revoked approval or any later caption, schedule, target, media or fingerprint drift is caught again by the live Notion dispatch gate immediately before Buffer write.
- Existing durable Buffer dispatch-intent and acceptance ledgers remain responsible for provider-side replay and partial-success safety.

## Trigger

Create a repository-owner issue whose title begins:

`[STAGE LINKEDIN RESERVE]`

and body contains:

```text
NOTION_PAGE: <exact Notion row URL or page ID>
```

The workflow stages one exact row at a time. It comments the exact locked `[APPROVED LINKEDIN]` body for owner review, but does not create it.

## Failure behaviour

Fail closed on missing or revoked approval, missing source/media, unsupported identity, stale review date, copy drift, schedule drift, bad media bytes/hash, same-revision mutation, Notion writeback failure or live pre-dispatch drift.

A queue-capacity shortage is not a staging failure. Once separately approved, the existing Buffer publisher waits under its normal capacity policy rather than creating duplicates.

## Current flywheel boundary

The bridge can be deployed without exposing any current reserve source files or operating metadata. Private Drive originals remain private until explicit owner approval authorises exact-binary promotion to the provider media surface. This distinction is deliberate.
