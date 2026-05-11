# Agent CLI Tooling Plan

## Why this was added

The video guidance points to a CLI-first agent setup: give agents compact, purpose-built command-line tools instead of making them repeatedly traverse broad APIs, MCP tool lists, or web pages. The main tool reviewed was Printing Press, which describes itself as a way to generate and install agent-designed Go CLIs plus matching skills and MCP servers.

Key takeaways applied here:

- Prefer agent-native CLIs for repeat work because they are easier to discover, script, test, and compose in the shell.
- Prefer compact output, local caches, SQLite-backed sync, full-text search, and compound commands where available.
- Keep MCP as an optional companion interface, not the only interface.
- Store the recommended tool stack as repository config so future agents can check and improve it without re-watching the video.

## Current installation status

A starter-pack install was attempted from this environment with:

```bash
npx -y @mvanhorn/printing-press install starter-pack
```

The command reached npm but failed with `403 Forbidden` for `@mvanhorn/printing-press`. A direct GitHub clone/download also hit a `403 Forbidden` tunnel response. The local Go runtime is available, but this container reports Go `1.25.1`, while the Printing Press documentation currently says Go `1.26.3` or newer is required for the generator and direct Go installs.

Because of those environment limits, this repository now carries a durable tooling plan and a checker script instead of vendoring third-party binaries.

## Repository additions

- `config/agent-cli-tools.example.json` records the CLI catalog sources, install commands, environment requirements, and the first recommended tool stack for this repo.
- `scripts/check-agent-cli-tooling.mjs` prints a machine-readable status report showing local Node/Go readiness, GitHub token presence, and whether the recommended binaries are already on `PATH`.

Run:

```bash
node scripts/check-agent-cli-tooling.mjs
```

## Recommended setup when network and credentials allow

1. Upgrade Go to `1.26.3` or newer.
2. Export `GITHUB_TOKEN` or `GH_TOKEN` if the Printing Press Library catalog or skills require authenticated fetches.
3. Install the starter pack:

   ```bash
   npx -y @mvanhorn/printing-press install starter-pack
   ```

4. Install the Printing Press generator binary if you want to create new CLIs from APIs, docs, HAR files, or websites:

   ```bash
   go install github.com/mvanhorn/cli-printing-press/v4/cmd/printing-press@latest
   printing-press --version
   ```

5. Re-run the local checker:

   ```bash
   node scripts/check-agent-cli-tooling.mjs
   ```

## New abilities this unlocks

### For Lindah's Flight Finds

- Use `flight-goat` to research live flights before turning sample deal data into live deal pages.
- Combine Google Flights, Kayak long-haul route scans, and FlightAware reliability checks in a single terminal workflow.
- Use `google-search-console` to find SEO pages with impressions but weak clicks, then prioritize title, meta, route, and itinerary improvements.
- Use `wikipedia` for lightweight public destination context, while still verifying travel and safety claims from primary sources before publishing.

### For 222Emails

- Use `klaviyo` for retention and opted-in lifecycle work while preserving the repo rule that Klaviyo is not the default cold outreach engine.
- Use `company-goat` for business-level lead qualification before scoring or drafting outreach.
- Use `dub` for campaign attribution and short-link inspection.
- Use security and package-intel CLIs such as `nvd` and `pypi` during dependency reviews.

### For future agent runs

- Run one checker command to see which agent CLIs are installed and what is missing.
- Keep CLI recommendations in a JSON manifest that scripts can parse.
- Add or remove recommended CLIs without changing application code.
- Preserve the compliance posture: tools may enrich research and drafting, but cold outreach still requires human review and fail-closed category handling.

## Operating rules

- Do not auto-send cold outreach from any new CLI workflow.
- Do not use personal enrichment tools unless a task has a clear legal basis and data-minimisation reason.
- Treat live fares, rankings, and SEO metrics as time-sensitive; re-check immediately before publication or action.
- Prefer read-only or `--dry-run` modes until credentials and safety gates are proven.
