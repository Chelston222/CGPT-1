# 222Emails Revenue Path Release State

- Canonical rebuild merged to `main`: 2026-09-03
- Merge commit: `4ac9985ab461ddf848c431d37b284b33c3a1ff98`
- Pull request: #556
- Isolated Revenue Path CI: PASSED
- Production release run: `33715221431`
- Production release source commit: `79e05c62be89859af170882f4b79131050ad754a`
- Canonical source build: PASSED
- Canonical naming/content gates: PASSED
- Verified Netlify draft deploy: `6a98f7dae531cc2527d89a35`
- Verified draft URL: `https://6a98f7dae531cc2527d89a35--222emails-homeproof-upgrade.netlify.app`
- Draft route and content smoke tests: PASSED
- Draft redirect rules: 5 processed successfully
- Draft header rules: PASSED
- Production promotion: BLOCKED
- Production blocker: Netlify returned `JSONHTTPError: Forbidden` only on `netlify deploy --prod`
- GitHub `NETLIFY_AUTH_TOKEN`: present but does not have production-publish authority for site `fc7ccb38-7e6d-4a15-83bc-88bd84ea5687`
- Existing production deploy remains unchanged until the production credential is re-authorised
- Temporary push trigger used for release verification: REMOVED
- Production workflow trigger state: manual `workflow_dispatch` only
- Canonical homepage source: `apps/222emails-omega-max/src/main.tsx`
- Canonical styling source: `apps/222emails-omega-max/src/styles.css`
- Public front door: `/revenue-recovery-check`
- Canonical Tally form: `https://tally.so/r/44057b`
- Tally attribution fields expanded: PASSED
- Tally completion redirect to `/revenue-recovery-check/thank-you`: CONFIGURED
- Legacy `/fit-check` redirect: IMPLEMENTED
- Old `RecoveryDashboard` release pattern: RETIRED from canonical source
- Old multipart source reconstruction in production workflow: RETIRED

## Only remaining release action

Replace or re-authorise the GitHub Actions secret `NETLIFY_AUTH_TOKEN` with a Netlify credential that can publish production deploys for site `fc7ccb38-7e6d-4a15-83bc-88bd84ea5687`, then manually run `222Emails Revenue Path Production`. The same workflow must pass the production publish and live smoke-test steps before the release is marked GREEN.

Do not rebuild the verified candidate merely to work around the credential. Do not restore the old Fit Check naming, `RecoveryDashboard`, multipart source reconstruction, or the previous August Omega Max release candidate as production truth.
