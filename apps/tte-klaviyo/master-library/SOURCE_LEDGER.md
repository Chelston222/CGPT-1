# Source and licence ledger

This library is original 222 Emails implementation code. It uses established email-engineering patterns rather than copying third-party templates verbatim.

Reference projects and platform contracts used to benchmark engineering decisions:

| Project / source | Use | Licence / posture |
|---|---|---|
| Lee Munroe Responsive HTML Email Template | conservative responsive shell patterns | MIT |
| Cerberus | hybrid/responsive and Outlook-safe patterns | MIT |
| Foundation for Emails | responsive-email architecture and compatibility benchmarking | MIT |
| Mailgun Transactional Email Templates | transactional layout benchmarking | MIT |
| Klaviyo Templates API | current CODE-template create/update/manage contract | official platform documentation |
| Klaviyo Get Templates API | exact-name filtering contract using `equals` | official platform documentation |
| Klaviyo Render Template API/OpenAPI | platform-side render verification contract | official platform documentation / OpenAPI |

Reference URLs:
- https://github.com/leemunroe/responsive-html-email-template
- https://github.com/TedGoas/Cerberus
- https://github.com/foundation/foundation-emails
- https://github.com/mailgun/transactional-email-templates
- https://developers.klaviyo.com/en/v2026-07-15/reference/templates_api_overview
- https://developers.klaviyo.com/en/reference/get_templates
- https://developers.klaviyo.com/en/reference/update_template
- https://developers.klaviyo.com/en/reference/render_template
- https://raw.githubusercontent.com/klaviyo/openapi/main/openapi/stable/apis/render_template.json

## Implementation rule

Do not paste commercial gallery templates into this library unless redistribution and client-use rights have been verified and recorded here first. External projects are benchmarking/reference sources. Client-facing HTML remains original 222 Emails implementation code.

## Platform version rule

The Klaviyo integration targets revision `2026-07-15`. Before changing API request shapes, endpoints, filters or scopes, verify them against current official Klaviyo documentation/OpenAPI and update this ledger when the contract changes.
