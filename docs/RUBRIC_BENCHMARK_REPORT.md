# Rubric Benchmark Report

Run started: 2026-05-09T21:34:01.790Z

Iterations: 5
Average score: 100/100
Overall status: PASS

## Stack run each iteration

- `node scripts/check-agent-cli-tooling.mjs` from `/workspace/CGPT-1`
- `npm run check:data` from `lindahs-flight-finds`
- `npm run lint` from `lindahs-flight-finds`
- `npm run build` from `lindahs-flight-finds`

## Iterations

### Iteration 1

Prompt: v1 environment recovery: if Printing Press install is blocked, can a future agent see exactly what failed and what to do next?

Score: 100/100

Commands:
- PASS `node scripts/check-agent-cli-tooling.mjs` (209ms, warnings: 0)
- PASS `npm run check:data` (285ms, warnings: 0)
- PASS `npm run lint` (3811ms, warnings: 0)
- PASS `npm run build` (8463ms, warnings: 0)

Rubric checks:
- PASS (10) Machine-readable CLI manifest exists and has recommended tools
- PASS (12) Readiness checker is runnable and returns next steps
- PASS (10) Application data quality check passes
- PASS (10) Lint command is modern ESLint and passes
- PASS (18) Production build passes
- PASS (10) Blocked install path is documented without pretending binaries are installed
- PASS (10) Compliance rails preserve human review and no cold auto-send
- PASS (20) Prompt-specific scenario is covered

### Iteration 2

Prompt: v2 Lindah flight-deal workflow: can a future agent use live flight research tools without hiding fare volatility or booking risk?

Score: 100/100

Commands:
- PASS `node scripts/check-agent-cli-tooling.mjs` (179ms, warnings: 0)
- PASS `npm run check:data` (276ms, warnings: 0)
- PASS `npm run lint` (4254ms, warnings: 0)
- PASS `npm run build` (8688ms, warnings: 0)

Rubric checks:
- PASS (10) Machine-readable CLI manifest exists and has recommended tools
- PASS (12) Readiness checker is runnable and returns next steps
- PASS (10) Application data quality check passes
- PASS (10) Lint command is modern ESLint and passes
- PASS (18) Production build passes
- PASS (10) Blocked install path is documented without pretending binaries are installed
- PASS (10) Compliance rails preserve human review and no cold auto-send
- PASS (20) Prompt-specific scenario is covered

### Iteration 3

Prompt: v3 222Emails compliance workflow: can a future agent use retention and research CLIs without breaching the no-auto-send cold outreach rule?

Score: 100/100

Commands:
- PASS `node scripts/check-agent-cli-tooling.mjs` (189ms, warnings: 0)
- PASS `npm run check:data` (276ms, warnings: 0)
- PASS `npm run lint` (3834ms, warnings: 0)
- PASS `npm run build` (8536ms, warnings: 0)

Rubric checks:
- PASS (10) Machine-readable CLI manifest exists and has recommended tools
- PASS (12) Readiness checker is runnable and returns next steps
- PASS (10) Application data quality check passes
- PASS (10) Lint command is modern ESLint and passes
- PASS (18) Production build passes
- PASS (10) Blocked install path is documented without pretending binaries are installed
- PASS (10) Compliance rails preserve human review and no cold auto-send
- PASS (20) Prompt-specific scenario is covered

### Iteration 4

Prompt: v4 SEO and attribution workflow: can a future agent prioritize content, Search Console, and campaign links from terminal-first tooling?

Score: 100/100

Commands:
- PASS `node scripts/check-agent-cli-tooling.mjs` (177ms, warnings: 0)
- PASS `npm run check:data` (280ms, warnings: 0)
- PASS `npm run lint` (3767ms, warnings: 0)
- PASS `npm run build` (8696ms, warnings: 0)

Rubric checks:
- PASS (10) Machine-readable CLI manifest exists and has recommended tools
- PASS (12) Readiness checker is runnable and returns next steps
- PASS (10) Application data quality check passes
- PASS (10) Lint command is modern ESLint and passes
- PASS (18) Production build passes
- PASS (10) Blocked install path is documented without pretending binaries are installed
- PASS (10) Compliance rails preserve human review and no cold auto-send
- PASS (20) Prompt-specific scenario is covered

### Iteration 5

Prompt: v5 repeatability workflow: can a future agent run one local stack to verify readiness, app quality, lint, and production build health?

Score: 100/100

Commands:
- PASS `node scripts/check-agent-cli-tooling.mjs` (192ms, warnings: 0)
- PASS `npm run check:data` (307ms, warnings: 0)
- PASS `npm run lint` (3965ms, warnings: 0)
- PASS `npm run build` (9202ms, warnings: 0)

Rubric checks:
- PASS (10) Machine-readable CLI manifest exists and has recommended tools
- PASS (12) Readiness checker is runnable and returns next steps
- PASS (10) Application data quality check passes
- PASS (10) Lint command is modern ESLint and passes
- PASS (18) Production build passes
- PASS (10) Blocked install path is documented without pretending binaries are installed
- PASS (10) Compliance rails preserve human review and no cold auto-send
- PASS (20) Prompt-specific scenario is covered

