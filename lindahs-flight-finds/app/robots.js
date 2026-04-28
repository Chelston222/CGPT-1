import { appConfig } from '../data/deals';

export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/']
    },
    sitemap: `${appConfig.baseUrl}/sitemap.xml`
  };
}
