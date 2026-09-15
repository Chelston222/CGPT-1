'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'linkedin-notion-reserve-stage.yml'), 'utf8');

test('staging trigger is restricted to repository-owner issues', () => {
  assert.match(workflow, /startsWith\(github\.event\.issue\.title, '\[STAGE LINKEDIN RESERVE\]'\)/);
  assert.match(workflow, /github\.event\.issue\.user\.login == github\.repository_owner/);
});

test('staging workflow never creates an approval issue', () => {
  assert.doesNotMatch(workflow, /issues\.create\s*\(/);
  assert.match(workflow, /This is not publication approval/);
});

test('staging workflow requires Notion and rechecks for drift before writeback', () => {
  assert.match(workflow, /NOTION_API_KEY is required for the reserve bridge/);
  assert.match(workflow, /Notion row changed during staging/);
  assert.match(workflow, /Live Notion row drifted after repository staging/);
});

test('only the governed replenishment file is committed by the workflow', () => {
  assert.match(workflow, /git add apps\/linkedin-review\/qa-replenishment-notion-reserve\.json/);
  assert.doesNotMatch(workflow, /git add -A|git add \./);
});