#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const manifestPath = resolve(repoRoot, 'config', 'agent-cli-tools.example.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

function commandOutput(command, args = []) {
  try {
    return {
      ok: true,
      output: execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000 }).trim()
    };
  } catch (error) {
    return {
      ok: false,
      output: `${error.stdout?.toString() || ''}${error.stderr?.toString() || ''}`.trim(),
      code: error.status ?? null
    };
  }
}

function commandExists(command) {
  const result = commandOutput('/bin/sh', ['-c', `command -v ${JSON.stringify(command)}`]);
  return result.ok ? result.output : null;
}

function parseMajorMinorPatch(versionText) {
  const match = versionText.match(/(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : null;
}

function atLeast(current, minimum) {
  if (!current) return false;
  for (let index = 0; index < minimum.length; index += 1) {
    if (current[index] > minimum[index]) return true;
    if (current[index] < minimum[index]) return false;
  }
  return true;
}

const nodeVersion = process.version.replace(/^v/, '');
const goVersionResult = commandOutput('go', ['version']);
const goVersion = goVersionResult.ok ? goVersionResult.output : null;
const goSemver = parseMajorMinorPatch(goVersion || '');

const knownBinaries = new Set([
  'printing-press',
  ...manifest.recommendedTools.map((tool) => tool.binary)
]);

const report = {
  checkedAt: new Date().toISOString(),
  manifest: manifestPath,
  runtime: {
    node: {
      version: nodeVersion,
      satisfiesProjectMinimum: atLeast(parseMajorMinorPatch(nodeVersion), [20, 0, 0])
    },
    go: {
      version: goVersion,
      satisfiesPrintingPressMinimum: atLeast(goSemver, [1, 26, 3])
    }
  },
  auth: {
    hasGitHubToken: Boolean(process.env.GITHUB_TOKEN || process.env.GH_TOKEN),
    note: 'Some Printing Press Library installs may require GITHUB_TOKEN or GH_TOKEN plus private Go module access.'
  },
  commands: Object.fromEntries(
    [...knownBinaries].sort().map((binary) => {
      const path = commandExists(binary);
      return [binary, { path, installed: Boolean(path) }];
    })
  ),
  installCommands: manifest.installCommands,
  nextSteps: []
};

if (!report.runtime.go.satisfiesPrintingPressMinimum) {
  report.nextSteps.push('Upgrade Go to 1.26.3 or newer before using Printing Press generator/direct Go installs.');
}

if (!report.auth.hasGitHubToken) {
  report.nextSteps.push('Export GITHUB_TOKEN or GH_TOKEN if the Printing Press catalog or skills fetch requires authenticated access.');
}

if (!report.commands['printing-press'].installed) {
  report.nextSteps.push(`Install the Printing Press binary: ${manifest.installCommands.pressBinary}`);
}

const missingPriorityTools = manifest.recommendedTools
  .filter((tool) => ['high', 'medium'].includes(tool.priority) && !report.commands[tool.binary]?.installed)
  .map((tool) => tool.name);

if (missingPriorityTools.length > 0) {
  report.nextSteps.push(`Install recommended high/medium priority tools when credentials allow: ${missingPriorityTools.join(', ')}.`);
}

if (!existsSync(manifestPath)) {
  report.nextSteps.push('Manifest file is missing; restore config/agent-cli-tools.example.json.');
}

console.log(JSON.stringify(report, null, 2));
