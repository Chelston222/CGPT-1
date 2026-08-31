'use strict';

(() => {
  const originalFetch = window.fetch.bind(window);
  const replenishmentFiles = [
    'qa-replenishment-2026-08-11.json',
    'qa-replenishment-2026-08-17.json',
  ];

  function isPublicScheduledPost(post) {
    return Boolean(
      post
      && post.mode === 'schedule'
      && post.scheduledAt
      && typeof post.scheduledAt === 'object'
      && Object.keys(post.scheduledAt).length > 0
    );
  }

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const response = await originalFetch(input, init);

    if (!/(^|\/)queue\.json(?:$|[?#])/.test(url) || !response.ok) return response;

    try {
      const queue = await response.clone().json();
      const existingIds = new Set((queue.posts || []).map((post) => post.id));
      const additions = [];
      const sources = [];

      for (const replenishmentFile of replenishmentFiles) {
        const replenishmentResponse = await originalFetch(replenishmentFile, { cache: 'no-store' });
        if (!replenishmentResponse.ok) continue;
        const replenishment = await replenishmentResponse.json();
        const eligible = (replenishment.posts || []).filter((post) =>
          !existingIds.has(post.id)
          && post.status === 'review'
          && post.qa?.status === 'ready_for_human_review'
          && post.qa?.approvalEligible === true
          && post.qa?.publishPermission === false
        );
        for (const post of eligible) {
          existingIds.add(post.id);
          additions.push(post);
        }
        sources.push({
          source: replenishmentFile,
          added: eligible.length,
          generatedAt: replenishment.generatedAt,
          approvalRule: replenishment.approvalRule,
        });
      }

      const allReviewRecords = [...(queue.posts || []), ...additions];
      const publicPosts = allReviewRecords.filter(isPublicScheduledPost);
      const merged = {
        ...queue,
        posts: publicPosts,
        qaReplenishment: {
          sources,
          added: additions.filter(isPublicScheduledPost).length,
          excludedNonPublic: allReviewRecords.length - publicPosts.length,
          approvalRule: 'QA replenishment is review-only. Explicit owner approval is still required before Buffer receives any item.',
        },
      };
      return new Response(JSON.stringify(merged), {
        status: response.status,
        statusText: response.statusText,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      });
    } catch {
      return response;
    }
  };
})();
