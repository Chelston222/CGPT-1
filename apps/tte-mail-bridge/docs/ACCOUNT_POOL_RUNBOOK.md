# Account Pool Runbook

## Operating principle

The pool may contain many authorised Gmail accounts, but it is not a mechanism for multiplying cold-email quotas. Each active sender needs a legitimate lane, healthy account state, recovery readiness and evidence-backed recipient permission.

## Launch shape

Recommended launch: 10 connected accounts, initially 1 to 2 active for controlled smoke and permissioned traffic, then progressively activate the remainder. New accounts remain subject to the built-in WARMING ramp: 5/day initially, +2 every 3 days, with the normal per-account ceiling set to 10/day.

The application has no hard-coded 10-account or 20-account maximum. The current serial Netlify Blobs design is intentionally low-concurrency. Before intentional high-throughput or heavy concurrent dispatch, move state and queue coordination to a transactional datastore.

## Recommended Gmail identities

Availability must be confirmed during Google account creation. These are functional identities, not a rotation pool. Keep each message category on its assigned sender wherever practical.

| Lane | First-choice Gmail | Purpose |
|---|---|---|
| relationship | `chelston.222emails@gmail.com` | Chelston-led relationship messages |
| fit-check | `fitcheck.222emails@gmail.com` | Client Return Fit Check |
| growth-check | `growthcheck.222emails@gmail.com` | Growth Check |
| client-return | `clientreturn.222emails@gmail.com` | Client Return delivery |
| follow-up | `followup.222emails@gmail.com` | Requested and existing-relationship follow-up |
| enquiries | `enquiries.222emails@gmail.com` | Inbound enquiries |
| partners | `partners.222emails@gmail.com` | Partnerships and referrals |
| clients | `clients.222emails@gmail.com` | Existing-customer operations |
| relationships | `relationships.222emails@gmail.com` | Relationship and requested follow-up |
| ops | `ops.222emails@gmail.com` | Internal testing and controlled operational overflow |

If a first-choice username is unavailable, add real characters such as `uk` or `tte`, for example `fitcheck.222emailsuk@gmail.com`. Do not rely on moving dots because personal Gmail treats dotted variants of the same username as the same account.

## Sender identity

Use a truthful sender display name. Default: `Chelston Phillip | 222Emails`. The control centre lets the operator set a friendly internal label independently from the external display name.

## Lane model

Do not rotate identical message categories across many From addresses simply to spread quota. Assign each account a clear operational lane. The operator console stores a friendly label and lane for each account so the full pool remains understandable at a glance.

## Recovery registry

For every account record:

- recovery email controlled by the operator;
- recovery phone represented in the console by last four digits only;
- recovery state: `VERIFIED`, `ACTION_REQUIRED` or `UNKNOWN`;
- automatic timestamp when recovery is marked verified.

Passwords, full recovery phone numbers, backup codes and passkeys must not be stored in the sender-control database or repository. Keep those in Google's own recovery mechanisms or an appropriate password manager.

## Activation checklist

Before relying on an account:

1. Account ownership confirmed.
2. Unique strong password stored in an appropriate password manager.
3. Google recovery methods configured and tested where available.
4. Google OAuth connected through the control centre.
5. External sender display name checked.
6. Lane and friendly label assigned.
7. Recovery email confirmed.
8. Recovery phone or passkey state confirmed with Google where available.
9. Recovery status marked `VERIFIED` in the console.
10. Account remains within WARMING cap.
11. Internal or permissioned smoke message succeeds.
12. Audit event and sent counter reconcile.
13. No auth, bounce, complaint or provider-warning signal is present.

## Account creation friction

Google can require verification during account creation and can limit repeated verification attempts. Do not attempt to defeat those controls. If legitimate account creation is blocked, stop adding consumer Gmail accounts and use fewer accounts or an appropriate Google Workspace or business-mail structure instead.

## Scaling

Scaling is deliberate, not automatic:

- 1 to 10: normal launch and operation.
- 11 to 20: supported by the same OAuth/account model, but only add accounts with distinct legitimate roles.
- 20+: review whether consumer Gmail remains the right provider model.
- high concurrency: transactional queue/state datastore required before claiming production-scale parallel dispatch.

Global safety caps remain configurable so the system is not permanently boxed into the launch count, but increasing a cap is an intentional operator action rather than an automatic result of connecting more accounts.
