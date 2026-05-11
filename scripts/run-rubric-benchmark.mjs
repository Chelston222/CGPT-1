#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const appRoot = resolve(repoRoot, 'lindahs-flight-finds');

const args = new Set(process.argv.slice(2));
const iterationArg = process.argv.find((arg) => arg.startsWith('--iterations='));
const iterations = Number(iterationArg?.split('=')[1] || 5);
const writeReport = args.has('--write-report');

if (!Number.isInteger(iterations) || iterations < 5) {
  console.error('Run the benchmark in full with --iterations=5 or greater.');
  process.exit(1);
}

const selfPrompts = [
  'v1 environment recovery: if Printing Press install is blocked, can a future agent see exactly what failed and what to do next?',
  'v2 Lindah flight-deal workflow: can a future agent use live flight research tools without hiding fare volatility or booking risk?',
  'v3 222Emails compliance workflow: can a future agent use retention and research CLIs without breaching the no-auto-send cold outreach rule?',
  'v4 SEO and attribution workflow: can a future agent prioritize content, Search Console, and campaign links from terminal-first tooling?',
  'v5 repeatability workflow: can a future agent run one local stack to verify readiness, app quality, lint, and production build health?'
];

const commandPlan = [
  {
    id: 'agent-cli-readiness',
    cwd: repoRoot,
    command: 'node',
    args: ['scripts/check-agent-cli-tooling.mjs'],
    required: true
  },
  {
    id: 'app-data-quality',
    cwd: appRoot,
    command: 'npm',
    args: ['run', 'check:data'],
    required: true
  },
  {
    id: 'app-lint',
    cwd: appRoot,
    command: 'npm',
    args: ['run', 'lint'],
    required: true,
    allowWarnings: true
  },
  {
    id: 'app-production-build',
    cwd: appRoot,
    command: 'npm',
    args: ['run', 'build'],
    required: true
  }
];

function runCommand(step) {
  const startedAt = Date.now();
  const result = spawnSync(step.command, step.args, {
    cwd: step.cwd,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1'
    }
  });

  const output = `${result.stdout || ''}${result.stderr || ''}`;
  return {
    id: step.id,
    command: [step.command, ...step.args].join(' '),
    cwd: step.cwd.replace(`${repoRoot}/`, ''),
    status: result.status ?? 1,
    passed: result.status === 0,
    durationMs: Date.now() - startedAt,
    warnings: (output.match(/warning/gi) || []).length,
    outputTail: output.trim().split('\n').slice(-12).join('\n')
  };
}

function includesAll(text, terms) {
  const lower = text.toLowerCase();
  return terms.every((term) => lower.includes(term.toLowerCase()));
}

function fileText(relativePath) {
  const path = resolve(repoRoot, relativePath);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function scoreRubric(commandResults, prompt) {
  const manifestText = fileText('config/agent-cli-tools.example.json');
  const docsText = fileText('docs/AGENT_CLI_TOOLING.md');
  const readmeText = fileText('README.md');
  const checkerText = fileText('scripts/check-agent-cli-tooling.mjs');
  const packageText = fileText('lindahs-flight-finds/package.json');
  const combined = `${manifestText}\n${docsText}\n${readmeText}\n${checkerText}\n${packageText}`;

  const checks = [
    {
      name: 'Machine-readable CLI manifest exists and has recommended tools',
      weight: 10,
      pass: existsSync(resolve(repoRoot, 'config/agent-cli-tools.example.json')) && includesAll(manifestText, ['recommendedTools', 'flight-goat', 'klaviyo'])
    },
    {
      name: 'Readiness checker is runnable and returns next steps',
      weight: 12,
      pass: commandResults.some((result) => result.id === 'agent-cli-readiness' && result.passed) && includesAll(checkerText, ['nextSteps', 'GITHUB_TOKEN', 'satisfiesPrintingPressMinimum'])
    },
    {
      name: 'Application data quality check passes',
      weight: 10,
      pass: commandResults.some((result) => result.id === 'app-data-quality' && result.passed)
    },
    {
      name: 'Lint command is modern ESLint and passes',
      weight: 10,
      pass: commandResults.some((result) => result.id === 'app-lint' && result.passed) && includesAll(packageText, ['"lint"', 'eslint .'])
    },
    {
      name: 'Production build passes',
      weight: 18,
      pass: commandResults.some((result) => result.id === 'app-production-build' && result.passed)
    },
    {
      name: 'Blocked install path is documented without pretending binaries are installed',
      weight: 10,
      pass: includesAll(docsText, ['403 Forbidden', 'Go `1.25.1`', 'instead of vendoring third-party binaries'])
    },
    {
      name: 'Compliance rails preserve human review and no cold auto-send',
      weight: 10,
      pass: includesAll(combined, ['Do not auto-send cold outreach', 'Human review', 'fail closed']) || includesAll(combined, ['Do not auto-send cold outreach', 'human-reviewed', 'fail-closed'])
    },
    {
      name: 'Prompt-specific scenario is covered',
      weight: 20,
      pass: prompt.includes('environment')
        ? includesAll(docsText, ['403 Forbidden', 'Upgrade Go', 'GITHUB_TOKEN'])
        : prompt.includes('flight-deal')
          ? includesAll(manifestText, ['flight-goat', 'final provider page', 'Do not imply fare availability is guaranteed'])
          : prompt.includes('compliance')
            ? includesAll(manifestText, ['klaviyo', 'Do not use as the default cold acquisition engine', 'Human review remains required'])
            : prompt.includes('SEO')
              ? includesAll(manifestText, ['google-search-console', 'title/meta', 'dub'])
              : includesAll(readmeText, ['node scripts/check-agent-cli-tooling.mjs']) && commandResults.every((result) => result.passed)
    }
  ];

  const earned = checks.reduce((sum, check) => sum + (check.pass ? check.weight : 0), 0);
  const possible = checks.reduce((sum, check) => sum + check.weight, 0);

  return {
    earned,
    possible,
    score: Math.round((earned / possible) * 100),
    checks
  };
}

const runStartedAt = new Date().toISOString();
const iterationReports = [];

for (let index = 0; index < iterations; index += 1) {
  const prompt = selfPrompts[index % selfPrompts.length];
  console.log(`\n=== Rubric benchmark iteration ${index + 1}/${iterations}: ${prompt} ===`);
  const commandResults = commandPlan.map(runCommand);
  for (const result of commandResults) {
    const marker = result.passed ? 'PASS' : 'FAIL';
    console.log(`${marker} ${result.command} (${result.durationMs}ms)`);
    if (!result.passed) console.log(result.outputTail);
  }

  const rubric = scoreRubric(commandResults, prompt);
  console.log(`Rubric score: ${rubric.score}/100`);

  iterationReports.push({
    iteration: index + 1,
    prompt,
    commands: commandResults,
    rubric
  });
}

const failedCommands = iterationReports.flatMap((report) => report.commands.filter((command) => !command.passed));
const failedRubrics = iterationReports.filter((report) => report.rubric.score < 90);
const averageScore = Math.round(iterationReports.reduce((sum, report) => sum + report.rubric.score, 0) / iterationReports.length);

const summary = {
  runStartedAt,
  iterations,
  averageScore,
  passed: failedCommands.length === 0 && failedRubrics.length === 0,
  failedCommandCount: failedCommands.length,
  failedRubricCount: failedRubrics.length,
  iterationReports
};

if (writeReport) {
  const lines = [
    '# Rubric Benchmark Report',
    '',
    `Run started: ${runStartedAt}`,
    '',
    `Iterations: ${iterations}`,
    `Average score: ${averageScore}/100`,
    `Overall status: ${summary.passed ? 'PASS' : 'FAIL'}`,
    '',
    '## Stack run each iteration',
    '',
    ...commandPlan.map((step) => `- \`${[step.command, ...step.args].join(' ')}\` from \`${step.cwd.replace(`${repoRoot}/`, '')}\``),
    '',
    '## Iterations',
    ''
  ];

  for (const report of iterationReports) {
    lines.push(`### Iteration ${report.iteration}`);
    lines.push('');
    lines.push(`Prompt: ${report.prompt}`);
    lines.push('');
    lines.push(`Score: ${report.rubric.score}/100`);
    lines.push('');
    lines.push('Commands:');
    for (const command of report.commands) {
      lines.push(`- ${command.passed ? 'PASS' : 'FAIL'} \`${command.command}\` (${command.durationMs}ms, warnings: ${command.warnings})`);
    }
    lines.push('');
    lines.push('Rubric checks:');
    for (const check of report.rubric.checks) {
      lines.push(`- ${check.pass ? 'PASS' : 'FAIL'} (${check.weight}) ${check.name}`);
    }
    lines.push('');
  }

  writeFileSync(resolve(repoRoot, 'docs', 'RUBRIC_BENCHMARK_REPORT.md'), `${lines.join('\n')}\n`);
}

console.log('\n=== Rubric benchmark summary ===');
console.log(JSON.stringify({
  iterations,
  averageScore,
  passed: summary.passed,
  failedCommandCount: failedCommands.length,
  failedRubricCount: failedRubrics.length
}, null, 2));

if (!summary.passed) process.exit(1);
