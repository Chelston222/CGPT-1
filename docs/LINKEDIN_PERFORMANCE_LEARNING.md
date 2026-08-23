# LinkedIn performance learning loop

## Objective

Keep the 222Emails LinkedIn pipeline supplied with stronger content by learning from observed publication and analytics evidence rather than replenishing by intuition alone.

## Evidence hierarchy

1. Paid outcome or attributable revenue
2. Proposal / qualified opportunity / Revenue Recovery Check progression
3. Enquiry / meaningful DM or reply
4. Comments, reactions, clicks and saves
5. Reach and impressions

Commercial evidence is never inferred. It must be explicitly captured against the source Buffer post ID.

## Performance model

The learner reads verified GitHub approval issues, Buffer analytics comments and the current QA-eligible content bank. It scores observed posts using engagement, interaction density, reach and impressions. Small samples are shrunk towards the observed median so a high percentage on tiny reach cannot automatically become the winning template.

If commercial markers exist, downstream outcomes can contribute up to 50% of the observed performance score.

## Replenishment policy

The live target is eight scheduled posts per LinkedIn channel, below the ten-post Buffer capacity ceiling. Recommendations use three lanes:

- 60% EXPLOIT: strongest current evidence
- 25% ADJACENT: related ideas that preserve learning momentum
- 15% EXPLORE: deliberately novel categories or approaches

Selection also penalises repeated categories and repeated primary traits so optimisation does not turn into duplication.

## Suppression rule

No category is suppressed from one or two weak posts. Temporary down-weighting requires at least three measured samples and an adjusted score below the configured threshold.

## Commercial markers

When a post causes a meaningful downstream action, add a source-issue marker using the exact Buffer post ID:

```text
<!-- LINKEDIN_COMMERCIAL_SIGNAL bufferId=<buffer-id> type=dm|enquiry|fit_check|qualified|proposal|paid valueGbp=<optional> -->
```

Only observed actions should be recorded.

## Release authority

The learning engine is read-only towards Buffer. It can rank already QA-eligible content and report live queue deficits. It cannot publish, reschedule, or manufacture repository-owner approval. Existing GitHub approval and Content OS release gates remain authoritative.
