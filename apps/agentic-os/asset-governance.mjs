const ACTIVE_AUTHORITY_STATES = new Set(['CURRENT_CANONICAL', 'LIVE_OPERATOR']);
const NON_EXECUTION_STATES = new Set(['SUPERSEDED', 'DORMANT', 'ARCHIVE']);

const normalise = value => String(value || '').trim().toUpperCase();

function timestamp(asset) {
  return new Date(asset.lastVerifiedAt || asset.modifiedAt || asset.createdAt || 0).getTime();
}

function parseVersion(value) {
  const match = String(value || '').match(/(?:^|\D)(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return [0, 0, 0];
  return [Number(match[1]), Number(match[2]), Number(match[3] || 0)];
}

function compareVersion(a, b) {
  const av = parseVersion(a.version || a.title);
  const bv = parseVersion(b.version || b.title);
  for (let i = 0; i < 3; i += 1) {
    if (av[i] !== bv[i]) return bv[i] - av[i];
  }
  return timestamp(b) - timestamp(a);
}

function familyKey(asset) {
  return asset.canonicalFor || asset.familyId || asset.duplicateFamily || asset.id;
}

function isArchive(asset) {
  const status = normalise(asset.status);
  if (asset.archive === true || asset.rollbackOnly === true || status === 'ARCHIVE') return true;
  return /(^|\b)(BACKUP|ROLLBACK|PRE[- ](?:CUT|BUILD|REFRESH|MIGRATION|OVERHAUL|STREAMLINE|CONTROL|MINIMAL|100K))\b/i.test(asset.title || '');
}

function isStale(asset, now, staleHours) {
  if (asset.sourceFresh === false || normalise(asset.sourceState) === 'STALE') return true;
  if (!asset.lastVerifiedAt || !ACTIVE_AUTHORITY_STATES.has(normalise(asset.authorityLevel || asset.status))) return false;
  const ageHours = Math.max(0, (new Date(now).getTime() - new Date(asset.lastVerifiedAt).getTime()) / 36e5);
  return ageHours > staleHours;
}

function canonicalCandidate(group) {
  const candidates = group.filter(asset => !isArchive(asset) && !asset.supersededBy && normalise(asset.status) !== 'SUPERSEDED');
  return [...candidates].sort((a, b) => {
    const aClaim = normalise(a.authorityLevel || a.status) === 'CURRENT_CANONICAL' ? 1 : 0;
    const bClaim = normalise(b.authorityLevel || b.status) === 'CURRENT_CANONICAL' ? 1 : 0;
    if (aClaim !== bClaim) return bClaim - aClaim;
    return compareVersion(a, b);
  })[0] || null;
}

export function evaluateAssets(state, options = {}) {
  const now = state.now || new Date().toISOString();
  const staleHours = Number(options.liveAssetStaleHours ?? state.assetPolicy?.liveAssetStaleHours ?? 168);
  const rawAssets = (state.assets || []).map(asset => ({ ...asset, status: normalise(asset.status || 'SUPPORTING') }));
  const groups = new Map();
  for (const asset of rawAssets) {
    const key = familyKey(asset);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(asset);
  }

  const blockers = [];
  const canonicals = new Map();
  for (const [key, group] of groups) {
    const claims = group.filter(asset => !isArchive(asset) && !asset.supersededBy && normalise(asset.authorityLevel || asset.status) === 'CURRENT_CANONICAL');
    if (claims.length > 1) {
      blockers.push({
        type: 'CANONICAL_CONFLICT',
        familyId: key,
        assetIds: claims.map(asset => asset.id),
        reason: `Multiple assets claim CURRENT_CANONICAL authority for ${key}.`
      });
    }
    canonicals.set(key, claims.length === 1 ? claims[0] : canonicalCandidate(group));
  }

  const assets = rawAssets.map(asset => {
    const key = familyKey(asset);
    const canonical = canonicals.get(key);
    const base = { ...asset, familyId: key, canonicalAssetId: canonical?.id || null, auditReason: null };

    if (isArchive(asset)) return { ...base, governanceState: 'ARCHIVE', auditReason: 'Backup/rollback material is preserved but cannot hold execution authority.' };
    if (asset.supersededBy || normalise(asset.status) === 'SUPERSEDED') {
      return { ...base, governanceState: 'SUPERSEDED', supersededBy: asset.supersededBy || null, auditReason: asset.supersededBy ? `Explicitly superseded by ${asset.supersededBy}.` : 'Explicitly marked superseded.' };
    }
    if (normalise(asset.status) === 'DORMANT') return { ...base, governanceState: 'DORMANT', auditReason: 'Asset is intentionally dormant and cannot drive execution until revalidated.' };

    const driftSignals = (asset.driftSignals || []).filter(Boolean);
    if (driftSignals.length) {
      return { ...base, governanceState: 'REPAIR_REQUIRED', driftSignals, auditReason: `Known operating drift: ${driftSignals.join('; ')}` };
    }
    if (isStale(asset, now, staleHours)) {
      return { ...base, governanceState: 'REVALIDATE', auditReason: `Live/authoritative asset evidence is stale beyond ${staleHours} hours or source freshness is false.` };
    }

    const conflict = blockers.find(blocker => blocker.familyId === key);
    if (conflict && conflict.assetIds.includes(asset.id)) {
      return { ...base, governanceState: 'CURRENT_CANONICAL', governanceWarning: conflict.reason, auditReason: 'Canonical claim preserved but execution authority is blocked until ambiguity is resolved.' };
    }

    if (canonical && canonical.id === asset.id) {
      const claimed = normalise(asset.authorityLevel || asset.status);
      const governanceState = claimed === 'LIVE_OPERATOR' ? 'LIVE_OPERATOR' : 'CURRENT_CANONICAL';
      return { ...base, governanceState, auditReason: governanceState === 'LIVE_OPERATOR' ? 'Current operator surface for this asset family.' : 'Canonical authority for this asset family.' };
    }

    const sameFamily = (groups.get(key) || []).filter(other => !isArchive(other) && !other.supersededBy && normalise(other.status) !== 'SUPERSEDED');
    if (sameFamily.length > 1) {
      return { ...base, governanceState: 'DUPLICATE', auditReason: `Non-canonical member of duplicate family ${key}; canonical candidate is ${canonical?.id || 'unresolved'}.` };
    }

    return { ...base, governanceState: 'SUPPORTING', auditReason: 'Supporting asset with no current authority conflict.' };
  });

  const counts = Object.fromEntries(['CURRENT_CANONICAL','LIVE_OPERATOR','SUPPORTING','REPAIR_REQUIRED','REVALIDATE','DUPLICATE','SUPERSEDED','DORMANT','ARCHIVE'].map(stateName => [stateName, assets.filter(asset => asset.governanceState === stateName).length]));
  return {
    now,
    assets,
    canonicalByFamily: Object.fromEntries([...canonicals.entries()].map(([key, asset]) => [key, asset?.id || null])),
    health: {
      ...counts,
      blockers,
      blockerCount: blockers.length,
      green: blockers.length === 0
    }
  };
}

export function governanceTasks(assetEvaluation) {
  const tasks = [];
  const duplicateFamilies = new Map();

  for (const asset of assetEvaluation.assets || []) {
    if (asset.governanceState === 'REPAIR_REQUIRED') {
      tasks.push({
        id: `asset-repair:${asset.id}`,
        familyId: `asset-repair:${asset.familyId}`,
        category: 'projectAction',
        title: `Repair stale operating truth: ${asset.title}`,
        desiredOutcome: `Restore ${asset.title} to current canonical operating truth`,
        source: 'AOS Asset Governance',
        sourceRef: asset.url || asset.id,
        createdAt: assetEvaluation.now,
        lastValidatedAt: assetEvaluation.now,
        durationMinutes: Number(asset.repairDurationMinutes || 45),
        strategicPriority: Number(asset.strategicPriority || 90),
        expectedValue: Number(asset.expectedValue || 80),
        impactProbability: 90,
        urgency: Number(asset.urgency || 82),
        dependencyUnlock: Number(asset.dependencyUnlock || 70),
        relevanceConfidence: 98,
        status: 'ACTIVE',
        assetId: asset.id,
        auditContext: asset.auditReason
      });
    }

    if (asset.governanceState === 'REVALIDATE') {
      tasks.push({
        id: `asset-revalidate:${asset.id}`,
        familyId: `asset-revalidate:${asset.familyId}`,
        category: 'projectAction',
        title: `Revalidate operating asset: ${asset.title}`,
        desiredOutcome: `Verify whether ${asset.title} remains current, useful and executable`,
        source: 'AOS Asset Governance',
        sourceRef: asset.url || asset.id,
        createdAt: assetEvaluation.now,
        lastValidatedAt: assetEvaluation.now,
        durationMinutes: Number(asset.revalidationDurationMinutes || 20),
        strategicPriority: Number(asset.strategicPriority || 70),
        expectedValue: Number(asset.expectedValue || 65),
        impactProbability: 85,
        urgency: Number(asset.urgency || 60),
        dependencyUnlock: Number(asset.dependencyUnlock || 45),
        relevanceConfidence: 96,
        status: 'ACTIVE',
        assetId: asset.id,
        auditContext: asset.auditReason
      });
    }

    if (asset.governanceState === 'DUPLICATE') {
      if (!duplicateFamilies.has(asset.familyId)) duplicateFamilies.set(asset.familyId, []);
      duplicateFamilies.get(asset.familyId).push(asset);
    }
  }

  for (const [familyId, duplicates] of duplicateFamilies) {
    const canonicalAssetId = duplicates[0]?.canonicalAssetId || assetEvaluation.canonicalByFamily?.[familyId] || null;
    tasks.push({
      id: `asset-consolidate:${familyId}`,
      familyId: `asset-consolidate:${familyId}`,
      category: 'projectAction',
      title: `Resolve duplicate asset family: ${familyId}`,
      desiredOutcome: `One unambiguous live authority for ${familyId}, with historical lineage preserved`,
      source: 'AOS Asset Governance',
      createdAt: assetEvaluation.now,
      lastValidatedAt: assetEvaluation.now,
      durationMinutes: 25,
      strategicPriority: 78,
      expectedValue: 72,
      impactProbability: 92,
      urgency: 66,
      dependencyUnlock: 60,
      relevanceConfidence: 98,
      status: 'ACTIVE',
      canonicalAssetId,
      duplicateAssetIds: duplicates.map(asset => asset.id)
    });
  }

  return tasks;
}

export function assetProjection(assetEvaluation) {
  return (assetEvaluation.assets || [])
    .filter(asset => !NON_EXECUTION_STATES.has(asset.governanceState))
    .map(asset => ({
      id: asset.id,
      title: asset.title,
      familyId: asset.familyId,
      state: asset.governanceState,
      canonicalAssetId: asset.canonicalAssetId,
      source: asset.source || null,
      version: asset.version || null,
      lastVerifiedAt: asset.lastVerifiedAt || null,
      nextAction: asset.governanceState === 'REPAIR_REQUIRED' ? `Repair ${asset.id}` : asset.governanceState === 'REVALIDATE' ? `Revalidate ${asset.id}` : asset.governanceState === 'DUPLICATE' ? `Consolidate ${asset.familyId}` : null,
      auditReason: asset.auditReason
    }));
}
