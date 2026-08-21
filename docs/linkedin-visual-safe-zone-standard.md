# LinkedIn Visual Safe-Zone Standard

Status: LOCKED production rule

## Purpose
Prevent important text, punctuation, logos, faces, phones, products or other focal objects from being clipped, visually cramped or appearing to bleed off the edge in LinkedIn/Buffer previews or published posts.

## Portrait standard
For 4:5 LinkedIn portrait graphics, render the final asset at exactly **1080 × 1350 px**.

### Critical-content safe zone
All text, logos, punctuation, UI labels and other critical information must remain inside:
- **130 px minimum from left and right edges**
- **135 px minimum from top and bottom edges**

This gives a protected critical-content rectangle of **820 × 1080 px** centred on the canvas.

### Subject safe zone
Any object intended to be seen in full, including a phone, product, face, hand-held item, card, screenshot frame or diagram, must remain **fully inside the canvas with visible breathing room**. As a default, keep the complete focal subject at least **90 px from every edge**.

Only non-critical background colour, texture, photography or intentionally full-bleed backdrop may extend to the canvas edge.

## Non-negotiable QA
Before an image can be approved for Buffer:
1. Inspect the actual final 1080 × 1350 render, not a thumbnail or preview.
2. Confirm no critical text, punctuation or logo enters the protected edge zone.
3. Confirm no focal subject is accidentally cropped or appears to continue beyond the canvas.
4. Confirm visual balance at mobile size and desktop size.
5. Confirm no fake names, fake conversations or UI details could misleadingly imply a real interaction unless the post explicitly explains that it is illustrative.
6. Confirm spelling, punctuation, currency, branding and factual claims.
7. Confirm the content itself is worth posting and strengthens the intended positioning rather than adding generic motivational noise.

## Approval headers
Every new approved LinkedIn issue must contain:

`CONTENT_QA: PASS`

And, for image posts:

`SAFE_ZONE_QA: PASS`

These fields mean the final native-resolution creative has been manually inspected against this standard. They are not permission to skip visual inspection.

## Platform notes
LinkedIn supports image ratios from 3:1 through 4:5. Assets outside the supported range can be centred and cropped. Even when the full 4:5 image is supported, important information should remain centred and away from edges because previews and surfaces can vary.
