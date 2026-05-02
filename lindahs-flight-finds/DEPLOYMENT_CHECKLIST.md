# Deployment Checklist

## Vercel import settings

- Repository: `Chelston222/CGPT-1`
- Root Directory: `lindahs-flight-finds`
- Framework Preset: Next.js
- Build Command: `npm run build`
- Install Command: default
- Output Directory: default

## Before public promotion

- Confirm `npm run build` passes in Vercel.
- Replace `appConfig.baseUrl` in `data/deals.js` with the final Vercel/custom domain.
- Review Privacy, Terms, Cookie Policy and Affiliate Disclosure.
- Add real email provider and explicit consent capture.
- Add analytics only after cookie/consent setup is agreed.
- Replace sample prices with live checked deal data or clearly label them as examples.
- Add clear affiliate disclosure near any outbound booking/referral buttons.

## QA checks

- Homepage loads.
- Deal cards filter and sort.
- Dynamic deal pages load.
- Legal pages load.
- `/sitemap.xml` loads.
- `/robots.txt` loads.
- Mobile layout is readable.
- No console errors.
