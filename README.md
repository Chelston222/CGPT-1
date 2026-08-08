# 222Emails Codex Starter

Initial seed and working Phase 1 scaffold for the 222Emails operating system.

## What this repo is for

222Emails is a calm, compliance-first outbound and retention system for local service businesses. The first working version is intentionally lightweight:

- CSV lead intake
- conservative ICP scoring
- fail-closed compliance classification
- draft-only outreach generation
- human review queues
- audit logs and daily summaries
- free GitHub Actions hygiene checks

## Power-mode default

When asked to execute autonomously, work in this order:

1. inspect the repo and current constraints;
2. make the smallest practical change that advances the operating system;
3. preserve the golden rules: cheap first, compliance first, draft first, review first;
4. run reproducible checks;
5. commit scoped changes with clear evidence.

See `docs/PHASE1_OPERATOR_RUNBOOK.md` for the operator workflow.

## Run the sample outbound loop

```bash
python scripts/outbound_pipeline.py
```

The sample run reads:

- `config/settings.example.json`
- `data/leads.sample.csv`

It writes:

- `output/review_queue.csv`
- `output/drafts.jsonl`
- `logs/audit.jsonl`
- `reports/daily_summary.md`

## Run tests

```bash
python -m unittest discover -s tests
```

## Safety rails

The current pipeline does **not** send email. It exports reviewable draft copy only. If `auto_send_enabled` is set to true, the pipeline fails closed.
