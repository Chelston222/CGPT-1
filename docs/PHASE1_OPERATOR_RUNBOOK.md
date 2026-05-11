# 222Emails Phase 1 Operator Runbook

## Power-mode operating posture

When working in this repository, default to high-autonomy execution:

1. Inspect the current system before changing it.
2. Make the smallest useful change that advances the Phase 1 operating system.
3. Preserve the compliance rails: cheap first, draft first, review first, fail closed.
4. Run the relevant command-level checks and leave reproducible evidence.
5. Commit only working, scoped changes.

## Daily outbound hygiene loop

Run the pipeline against the sample files first:

```bash
python scripts/outbound_pipeline.py
```

For real lead intake, copy `config/settings.example.json` to a private settings file and pass a private lead CSV:

```bash
python scripts/outbound_pipeline.py \
  --settings config/settings.local.json \
  --leads data/leads.local.csv \
  --output-dir output \
  --logs-dir logs \
  --reports-dir reports
```

## Generated files

- `output/review_queue.csv` contains every checked lead, its score, compliance status, and the decision.
- `output/drafts.jsonl` contains draft-only outreach copy for human review.
- `logs/audit.jsonl` appends an audit event for each processed lead.
- `reports/daily_summary.md` gives the operator a quick daily status report.

## Review gates before any send

A draft can only be copied into Gmail if:

- `decision` is `draft_for_review`.
- `compliance_status` is `allowed`.
- The personalisation is grounded in the lead notes or visible public facts.
- The opt-out text is present.
- The operator has checked duplicate contact risk.

## Fail-closed rules

The pipeline intentionally blocks or holds records when:

- `auto_send_enabled` is true.
- the company type is not clearly corporate B2B;
- the lead status is bounced, unsubscribed, complained, or do-not-contact;
- required lead fields are missing;
- the score is below the configured draft threshold.

## Next sensible improvements

- Add a private real lead CSV outside version control.
- Add Gmail API draft creation only after OAuth credentials and a human-review queue are ready.
- Add reply/outcome ingestion so weekly reports can track positive replies and calls booked.
- Add sector-specific templates once enough approved draft examples exist.
