import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluateAssets, governanceTasks, assetProjection } from './asset-governance.mjs';
import { evaluateState, loadConfig } from './engine.mjs';

const config = loadConfig();
const state = JSON.parse(fs.readFileSync(new URL('./fixtures/asset-governance.json', import.meta.url), 'utf8'));
const evaluated = evaluateAssets(state);
const byId = id => evaluated.assets.find(asset => asset.id === id);

assert.equal(evaluated.health.green, true, 'current estate must have one unambiguous canonical authority per family');
assert.equal(byId('master-v118').governanceState, 'CURRENT_CANONICAL');
assert.equal(byId('master-v117').governanceState, 'SUPERSEDED');
assert.equal(byId('master-v117').supersededBy, 'master-v118');
assert.equal(byId('follow-sun-live').governanceState, 'LIVE_OPERATOR');
assert.equal(byId('follow-sun-old').governanceState, 'SUPERSEDED');
assert.equal(byId('follow-sun-old').supersededBy, 'follow-sun-live');
assert.equal(byId('chelsi-tracker').governanceState, 'LIVE_OPERATOR');
assert.equal(byId('agency-crm').governanceState, 'DORMANT');
assert.equal(byId('visual-v31').governanceState, 'CURRENT_CANONICAL');
assert.equal(byId('visual-v30').governanceState, 'SUPERSEDED');
assert.equal(byId('commercial-backup').governanceState, 'ARCHIVE');

const currentTasks = governanceTasks(evaluated);
assert.equal(currentTasks.length, 0, 'verified current estate must not regenerate already-closed repair/revalidation/duplicate work');

const currentProjection = assetProjection(evaluated);
assert(currentProjection.some(asset => asset.id === 'master-v118'));
assert(currentProjection.some(asset => asset.id === 'follow-sun-live'));
assert(currentProjection.some(asset => asset.id === 'chelsi-tracker'));
assert.equal(currentProjection.some(asset => asset.id === 'agency-crm'), false, 'dormant assets must not appear on active projection');
assert.equal(currentProjection.some(asset => asset.id === 'master-v117'), false, 'superseded assets must not appear on active projection');
assert.equal(currentProjection.some(asset => asset.id === 'commercial-backup'), false, 'archives must not appear on active projection');

// Synthetic problem-state coverage keeps repair/revalidation/duplicate detection tested
// without encoding resolved historical defects as if they were still live.
const problemState = {
  now: '2026-09-02T14:35:00Z',
  assets: [
    {
      id: 'drifted-live',
      title: 'Drifted live operator',
      familyId: 'drift-family',
      authorityLevel: 'LIVE_OPERATOR',
      status: 'LIVE_OPERATOR',
      lastVerifiedAt: '2026-09-02T14:00:00Z',
      driftSignals: ['obsolete route remains active']
    },
    {
      id: 'stale-live',
      title: 'Stale live operator',
      familyId: 'stale-family',
      authorityLevel: 'LIVE_OPERATOR',
      status: 'LIVE_OPERATOR',
      lastVerifiedAt: '2026-08-20T09:00:00Z'
    },
    {
      id: 'duplicate-canonical',
      title: 'Duplicate family canonical',
      familyId: 'duplicate-family',
      version: '2.0.0',
      authorityLevel: 'CURRENT_CANONICAL',
      status: 'CURRENT_CANONICAL',
      lastVerifiedAt: '2026-09-02T14:00:00Z'
    },
    {
      id: 'duplicate-old',
      title: 'Duplicate family old member',
      familyId: 'duplicate-family',
      version: '1.0.0',
      status: 'SUPPORTING',
      lastVerifiedAt: '2026-09-02T13:00:00Z'
    },
    {
      id: 'archive-only',
      title: 'BACKUP — Historical rollback',
      familyId: 'archive-family',
      archive: true
    }
  ]
};

const problems = evaluateAssets(problemState);
const problemById = id => problems.assets.find(asset => asset.id === id);
assert.equal(problems.health.green, true, 'repair debt may exist without an authority conflict');
assert.equal(problemById('drifted-live').governanceState, 'REPAIR_REQUIRED');
assert.equal(problemById('stale-live').governanceState, 'REVALIDATE');
assert.equal(problemById('duplicate-canonical').governanceState, 'CURRENT_CANONICAL');
assert.equal(problemById('duplicate-old').governanceState, 'DUPLICATE');
assert.equal(problemById('archive-only').governanceState, 'ARCHIVE');

const generated = governanceTasks(problems);
assert.equal(generated.filter(task => task.id === 'asset-repair:drifted-live').length, 1, 'drifted live asset must emit one repair task');
assert.equal(generated.filter(task => task.id === 'asset-revalidate:stale-live').length, 1, 'stale live asset must emit one revalidation task');
assert.equal(generated.filter(task => task.id === 'asset-consolidate:duplicate-family').length, 1, 'duplicate family must emit one consolidation task');
assert.equal(generated.some(task => task.assetId === 'archive-only'), false, 'archive assets must never emit execution work');

const taskEval = evaluateState({ now: problemState.now, tasks: generated, outcomes: [], hardCommitments: [] }, config);
assert.equal(taskEval.health.green, true, 'governance tasks must pass through the existing task engine without duplicate executable families');
assert(taskEval.ranked.some(task => task.id === 'asset-repair:drifted-live'));
assert(taskEval.ranked.some(task => task.id === 'asset-revalidate:stale-live'));
assert(taskEval.ranked.some(task => task.id === 'asset-consolidate:duplicate-family'));

const conflict = evaluateAssets({
  now: state.now,
  assets: [
    { id: 'a', title: 'Canonical A', familyId: 'conflict-family', authorityLevel: 'CURRENT_CANONICAL', status: 'CURRENT_CANONICAL', lastVerifiedAt: state.now },
    { id: 'b', title: 'Canonical B', familyId: 'conflict-family', authorityLevel: 'CURRENT_CANONICAL', status: 'CURRENT_CANONICAL', lastVerifiedAt: state.now }
  ]
});
assert.equal(conflict.health.green, false, 'multiple current-canonical claims must fail closed');
assert.equal(conflict.health.blockerCount, 1);
assert.equal(conflict.health.blockers[0].type, 'CANONICAL_CONFLICT');

console.log(JSON.stringify({
  currentAssetHealth: evaluated.health,
  currentGeneratedTasks: currentTasks.map(task => task.id),
  currentProjectionCount: currentProjection.length,
  syntheticGeneratedTasks: generated.map(task => task.id),
  conflictGate: conflict.health
}, null, 2));
