import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluateAssets, governanceTasks, assetProjection } from './asset-governance.mjs';
import { evaluateState, loadConfig } from './engine.mjs';

const config = loadConfig();
const state = JSON.parse(fs.readFileSync(new URL('./fixtures/asset-governance.json', import.meta.url), 'utf8'));
const evaluated = evaluateAssets(state);
const byId = id => evaluated.assets.find(asset => asset.id === id);

assert.equal(evaluated.health.green, true, 'fixture must have one unambiguous canonical authority per family');
assert.equal(byId('master-v117').governanceState, 'CURRENT_CANONICAL');
assert.equal(byId('master-v116').governanceState, 'SUPERSEDED');
assert.equal(byId('master-v116').supersededBy, 'master-v117');
assert.equal(byId('follow-sun-new').governanceState, 'CURRENT_CANONICAL');
assert.equal(byId('follow-sun-old').governanceState, 'DUPLICATE');
assert.equal(byId('chelsi-tracker').governanceState, 'REPAIR_REQUIRED');
assert.equal(byId('agency-crm').governanceState, 'REVALIDATE');
assert.equal(byId('visual-v31').governanceState, 'CURRENT_CANONICAL');
assert.equal(byId('visual-v30').governanceState, 'SUPERSEDED');
assert.equal(byId('commercial-backup').governanceState, 'ARCHIVE');

const generated = governanceTasks(evaluated);
assert.equal(generated.filter(task => task.id === 'asset-repair:chelsi-tracker').length, 1, 'drifted live asset must emit one repair task');
assert.equal(generated.filter(task => task.id === 'asset-revalidate:agency-crm').length, 1, 'stale live asset must emit one revalidation task');
assert.equal(generated.filter(task => task.id === 'asset-consolidate:tte-follow-the-sun').length, 1, 'duplicate family must emit one consolidation task');
assert.equal(generated.some(task => task.assetId === 'commercial-backup'), false, 'archive assets must never emit execution work');

const taskEval = evaluateState({ now: state.now, tasks: generated, outcomes: [], hardCommitments: [] }, config);
assert.equal(taskEval.health.green, true, 'governance tasks must pass through the existing task engine without duplicate executable families');
assert(taskEval.ranked.some(task => task.id === 'asset-repair:chelsi-tracker'), 'repair work must enter existing dynamic ranking');
assert(taskEval.ranked.some(task => task.id === 'asset-revalidate:agency-crm'), 'revalidation work must enter existing dynamic ranking');
assert(taskEval.ranked.some(task => task.id === 'asset-consolidate:tte-follow-the-sun'), 'consolidation work must enter existing dynamic ranking');

const projection = assetProjection(evaluated);
assert(projection.some(asset => asset.id === 'master-v117'));
assert(projection.some(asset => asset.id === 'chelsi-tracker'));
assert.equal(projection.some(asset => asset.id === 'master-v116'), false, 'superseded assets should not appear on active projection');
assert.equal(projection.some(asset => asset.id === 'commercial-backup'), false, 'archives should not appear on active projection');

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
  assetHealth: evaluated.health,
  generatedTasks: generated.map(task => task.id),
  projectionCount: projection.length,
  conflictGate: conflict.health
}, null, 2));
