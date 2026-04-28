import { appConfig, deals, seoPages } from '../data/deals';

export default function sitemap() {
  const now = new Date();
  const staticRoutes = seoPages
    .filter((route) => !route.includes('['))
    .map((route) => ({
      url: `${appConfig.baseUrl}${route}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: route === '/' ? 1 : 0.6
    }));

  const dealRoutes = deals.map((deal) => ({
    url: `${appConfig.baseUrl}/deals/${deal.slug}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.8
  }));

  return [
    { url: appConfig.baseUrl, lastModified: now, changeFrequency: 'daily', priority: 1 },
    ...staticRoutes,
    ...dealRoutes
  ];
}
