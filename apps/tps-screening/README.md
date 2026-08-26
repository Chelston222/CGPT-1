# 222Emails TPS / CTPS Screening

Purpose: convert prospect phone numbers into dated screening evidence without manual spreadsheet work or accidental paid overage.

## Provider 1 — TPSCheck.uk

Status: integration implemented, awaiting API credential.

- Free account: 50 checks/month.
- API base: `https://api.tpscheck.uk/`
- Authentication: `Authorization: Token <API_KEY>`
- Single check: `POST /check?version=2`
- Credits: `GET /credits`
- Repository secret required: `TPSCHECK_API_KEY`

The queue runner queries remaining credits before processing and will not intentionally exceed the provider-reported remaining balance.

## Provider 2 — TPSChecker

Status: adapter intentionally disabled.

TPSChecker publicly documents an API, but its public documentation does not establish that the normal 10-free-per-day web allowance is usable through the API. Their API page references separate trial credits. Do not automate or spend credits until an API credential/free allowance is explicitly confirmed.

Future repository secret: `TPSCHECKER_API_KEY`.

## Automation

Workflow: `.github/workflows/tps-screening-daily.yml`

- Scheduled daily at 07:00 UTC.
- Can also be run manually.
- Default maximum 10 checks/run.
- Fails closed when credentials or credits are unavailable.
- Records screening evidence in `state/results.jsonl`.
- Updates `state/queue.json` only after a successful result.
- A number is `CLEAR_TO_CALL` only when it is valid and both `tps=false` and `ctps=false` in the provider response.
- Registered numbers become `REGISTERED_DO_NOT_CALL`.

## Queue contract

`state/queue.json` contains prospect records with lead ID, business, decision maker, phone and status. Current four priority call prospects were seeded on setup.

## Required human credential step

1. Create the free TPSCheck.uk account.
2. Copy the API key from its profile/dashboard.
3. In GitHub repository Settings → Secrets and variables → Actions → New repository secret.
4. Name: `TPSCHECK_API_KEY`.
5. Value: the provider API key.
6. Run the `TPS screening daily` workflow manually once to verify the four seeded records.

Never commit API keys to the repository.
