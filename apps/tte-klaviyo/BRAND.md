# 222 Emails V3 Klaviyo Brand Lock

Status: LOCKED FOR SOURCE  
Canonical source: Google Drive `TTE v3 Logo Pack.pptx`  
Drive file ID: `1M6eIiRIbAPJzvfWL4o-eK1Ddxv07E07c`

## Canonical palette

- Deep navy: `#06173D`
- Orange: `#FF6600`
- Warm cream: `#F7F3EC`
- Light grey: `#F5F5F5`
- Charcoal: `#222222`

## Logo rule

Designed 222 Emails emails must use the real supplied V3 logo asset. Do not recreate the script mark as text, substitute a legacy logo or use an AI-generated approximation.

For the current light/cream email surfaces, the canonical source variant is `02_primary_logo_light.png` / its transparent equivalent from the same V3 pack. The deployment source uses `__TTE_LOGO_URL__` and deliberately refuses deployment until a stable, publicly loadable Klaviyo-hosted URL for the real V3 asset is supplied.

## Founder-message exception

E01 is intentionally plain/founder-style and has no image dependency. This is a deliberate creative and inbox-style choice, not permission to fake or recreate the logo. E02-E05 are branded assets and require the real V3 logo.

## Accessibility rule

- Body copy uses navy/charcoal on warm cream/white.
- Orange is a high-salience accent and CTA surface, paired with navy text for strong contrast.
- Do not use low-contrast legacy teal as small text on white.
- Important meaning must not depend on colour alone.

## Source QA

`source_audit.py` fails designed templates that:

- contain the legacy teal palette,
- omit the real-logo deployment placeholder,
- recreate `TTE` as a fake text wordmark,
- omit unsubscribe controls,
- contain dead links,
- lose the Fit Check destination/UTM path,
- or introduce em dashes against the TTE copy lock.
