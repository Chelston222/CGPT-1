# 222Emails TPS / CTPS Screening

Purpose: convert prospect phone numbers into dated screening evidence without manual spreadsheet work or accidental paid overage.

## Provider 1 — TPSChecker

Status: integration implemented, awaiting account credentials.

- Each account receives 10 free checks each day, expiring at midnight GMT.
- API uses the same email/password as the normal web account.
- Balance: `POST https://www.tpschecker.co.uk/api/check-balance.aspx`
- Single number: `POST https://www.tpschecker.co.uk/api/check-number.aspx`
- Screens TPS and CTPS together.
- Repository secrets required: `TPSCHECKER_EMAIL`, `TPSCHECKER_PASSWORD`.

The queue runner reads `FreeChecksToday` and intentionally uses only that free balance. It ignores paid credits even if the account contains them.

## Provider 2 — TPSCheck.uk

Status: integration implemented, awaiting API credential.

- Free account: 50 checks/month.
- API base: `https://api.tpscheck.uk/`
- Authentication: `Authorization: Token <API_KEY>`
- Single check: `POST /check?version=2`
- Credits: `GET /credits`
- Repository secret required: `TPSCHECK_API_KEY`.

The runner queries remaining monthly credits before every run.

## Automation

Workflow: `.github/workflows/tps-screening-daily.yml`

Scheduled every day at 07:00 UTC.

Automatic mode:
1. TPSChecker processes up to 10 pending numbers, bounded by `FreeChecksToday` only.
2. TPSCheck.uk then processes up to 2 additional pending numbers, bounded by its provider-reported remaining monthly credits.
3. At typical full utilisation this yields approximately 300 TPSChecker checks/month plus up to 50 TPSCheck.uk checks/month.

The workflow can also be manually run against either provider.

Safety / cost rules:
- Missing credentials: no check, no state mutation.
- No free TPSChecker credits: stop; do not touch paid credits.
- No TPSCheck.uk monthly credits: stop.
- No automatic purchase, upgrade or overage.
- Results are appended to `state/results.jsonl`.
- `state/queue.json` changes only after a successful provider result.
- `CLEAR_TO_CALL` requires a valid number and both TPS=false and CTPS=false.
- Registered numbers become `REGISTERED_DO_NOT_CALL`.

## Queue contract

`state/queue.json` contains prospect records with lead ID, business, decision maker, phone and status. The initial four priority call prospects are already seeded.

## Required credential steps

### TPSChecker
1. Create/log into the free TPSChecker account.
2. In GitHub repository Settings → Secrets and variables → Actions, add:
   - `TPSCHECKER_EMAIL`
   - `TPSCHECKER_PASSWORD`
3. These are the same credentials used by the TPSChecker web account.

### TPSCheck.uk
1. Create the free account.
2. Copy the API key from the provider dashboard/profile.
3. Add GitHub Actions secret `TPSCHECK_API_KEY`.

Then run `TPS screening daily` manually once in `auto` mode. The four seeded prospects should be screened and written to the audit state if credentials are valid.

Never commit credentials or API keys to the repository.
