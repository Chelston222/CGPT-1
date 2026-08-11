# 222 Emails Revenue Template OS

This layer turns the 30 technical HTML masters into a client-production system.

## Core model

`30 revenue jobs × 5 layout systems × modular evidence/persuasion blocks = 150 core compositions before module combinations.`

The library does **not** mass-deploy every combination. It materialises only the client-specific draft required for a real journey problem.

## Five layout systems

1. **Performance Minimal** — low-friction, direct, conversion-focused.
2. **Premium Editorial** — premium spacing and typography for story, launches and content.
3. **Commerce Product** — product evidence and shopping continuity high in the hierarchy.
4. **Proof First** — evidence, mechanism and risk reduction before the CTA.
5. **Founder Human** — visually light, human, reply-friendly communication.

## Reusable modules

- proof strip
- testimonial
- benefit stack
- objection FAQ
- guarantee
- offer box
- social proof quote
- truthful urgency
- founder note
- next steps
- delivery reassurance
- comparison
- VIP access
- mechanism explainer

A module is allowed only when the client can provide the data required by its contract. Never manufacture proof, urgency, guarantees, customer quotes or commercial results.

## Build flow

1. Diagnose the customer journey problem.
2. Choose the correct revenue-job slug from `library/registry.json`.
3. Choose the layout system that best matches the decision context.
4. Create a client manifest from `client_manifest.example.json`.
5. Supply real logo, hero and product assets where the underlying template uses them.
6. Add only evidence/persuasion modules backed by real client facts.
7. Build:

```bash
python apps/tte-klaviyo/master-library/build_client_email.py client.json --out build/client-email.html
```

8. Run OS QA:

```bash
python apps/tte-klaviyo/master-library/validate_revenue_os.py
```

9. Inspect desktop, mobile, dark mode and images-off state.
10. Send controlled seed tests.
11. Verify links, tracking, dynamic event data, suppression logic and sending-domain health.
12. Only then deploy as a Klaviyo draft for the client.

## Hard rules

- One email has one dominant commercial job.
- Outcome clarity beats visual novelty.
- Critical copy stays live text, not baked into imagery.
- A CTA must describe the next action clearly.
- Real urgency only.
- Real proof only.
- Real guarantees only.
- No placeholder assets in a client-ready build.
- The builder never activates a flow or sends to subscribers.

## Platform posture

The system targets Klaviyo `CODE` HTML templates. Client builds remain source-controlled and reproducible. The account should contain the templates we actually use, not every theoretical permutation.

## Current QA surface

`validate_revenue_os.py` exercises all 30 revenue jobs across all 5 layout systems, then independently renders every conversion module and applies structural safety checks.
