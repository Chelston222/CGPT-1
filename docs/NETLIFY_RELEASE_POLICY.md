# Netlify Production Release Policy

Effective: 2026-09-13

## Governing principle

222Emails treats Netlify production deployments as scarce release events, not as an automatic side effect of development.

The technical stack exists to increase revenue throughput and reliability. It must not create avoidable infrastructure consumption merely because a change was committed.

## Default path

```text
change
  -> branch
  -> pull request
  -> deterministic CI / local build checks
  -> preview or isolated draft only when it materially improves QA
  -> merge
  -> explicit production release
  -> production readback / smoke verification
```

## Rules

1. A merge to `main` does not, by itself, justify a production deployment.
2. Background processing should not be placed on Netlify merely because serverless functions are available.
3. New Netlify projects require a genuine human-facing web-interface need or another clearly documented reason that beats the existing stack.
4. Changes should be batched into one verified production release where this does not materially delay revenue or risk resolution.
5. Production workflows must remain explicitly triggerable and reversible.
6. Existing production services remain live until a replacement is proven through real readback evidence.
7. Do not migrate a working service simply for architectural neatness.
8. Where an n8n or Make workflow can remove backend processing safely and with less operational cost, migration is evaluated only after the replacement passes equivalent gates.

## Immediate safeguards

- `TTE Mail Bridge Apex Deploy` is explicit/manual only.
- LinkedIn media no longer production-deploys automatically when media files are merged. It is explicitly released through workflow dispatch or the existing owner-only deploy issue path.
- The primary 222Emails revenue-path production workflows already require explicit/manual dispatch apart from their historical self-file trigger path. They should not be edited casually because changing those workflow files can itself invoke a release under the legacy trigger.

## Release gate

Before a production deployment, answer YES to all applicable items:

- Does the production environment actually need this change now?
- Has the change passed its deterministic CI/build checks?
- Has relevant preview/draft QA passed where preview adds value?
- Have we avoided combining unrelated risky changes?
- Is rollback available?
- Is the expected business/risk benefit worth the production deployment?

If not, do not deploy yet.

## Exceptions

Security incidents, broken revenue paths, broken client-facing production systems and other urgent production defects may be released immediately once the smallest safe fix passes the appropriate gate.
