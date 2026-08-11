'use strict';

(() => {
  const originalFetch = window.fetch.bind(window);
  const replenishmentFile = 'qa-replenishment-2026-08-11.json';

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const response = await originalFetch(input, init);

    if (!/(^|\/)queue\.json(?:$|[?#])/.test(url) || !response.ok) return response;

    try {
      const queue = await response.clone().json();
      const replenishmentResponse = await originalFetch(replenishmentFile, { cache: 'no-store' });
      if (!replenishmentResponse.ok) return response;
      const replenishment = await replenishmentResponse.json();
      const existingIds = new Set((queue.posts || []).map((post) => post.id));
      const additions = (replenishment.posts || []).filter((post) => !existingIds.has(post.id));
      const merged = {
        ...queue,
        posts: [...(queue.posts || []), ...additions],
        qaReplenishment: {
          source: replenishmentFile,
          added: additions.length,
          generatedAt: replenishment.generatedAt,
          approvalRule: replenishment.approvalRule,
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
