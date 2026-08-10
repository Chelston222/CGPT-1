# 222 Emails Flagship Klaviyo Proof System

Status: BUILD READY, NOT LIVE
Owner: 222 Emails
Purpose: operate as a real lead nurture flow and a public proof piece demonstrating TTE strategy, copy, lifecycle architecture and email design.

## Core flow

Trigger: joins `TTE Main Newsletter / Lead List` with email marketing consent.

1. W01 Founder Welcome, immediately, plain-text style
2. Wait 1 day
3. W02 Revenue Leak Diagnostic, text-led
4. Wait 2 days
5. W03 What We Would Fix First, designed proof email
6. Wait 2 days
7. W04 Proof > Promises, designed flagship case-study email
8. Wait 2 days
9. W05 Want Us To Find Yours?, founder-style conversion email

Primary conversion: `Audit Requested` custom event or equivalent form-success event.

## Exit / suppression logic

A contact should stop receiving sales-oriented welcome messages after becoming a client or requesting an audit where a sales follow-up sequence takes over. Suppressed/unsubscribed profiles must never be forced through marketing sends.

Recommended profile properties:
- `tte_lead_source`
- `tte_primary_goal`
- `tte_business_type`
- `tte_audit_status`
- `tte_client_status`

## Message specifications

### W01 Founder Welcome
Subject A: Welcome to 222 Emails
Subject B: You’re in. Here’s what happens next
Preview: A quick hello, and what I’ll actually send you.
Sender: Chelston at 222 Emails
Format: minimal/plain-text style
CTA: Reply with the biggest email problem in the business

Copy:

Hi {{ first_name|default:'there' }},

Thanks for joining 222 Emails.

I’m Chelston, founder of 222 Emails.

We help businesses turn email from something they occasionally send into a system that brings customers back, recovers missed revenue and creates more value from the audience they already worked to acquire.

That means I’m not going to fill your inbox just to say we sent another email.

Over the next few days, I’ll show you:

• where businesses commonly lose revenue after a lead or customer enters their world
• what we would normally fix first
• examples of the strategy and creative behind the systems we build
• how to identify opportunities inside your own email setup

One question before I do:

What is the biggest problem with your email marketing right now?

Just reply to this email. I read the responses.

Chelston
Founder, 222 Emails

P.S. If the answer is “we barely use email at all”, that is useful information too.

Success event: reply or qualified site visit. Do not optimise around opens alone.

### W02 Revenue Leak Diagnostic
Subject A: 5 places revenue quietly disappears
Subject B: Your list might not be the problem
Preview: Before buying more traffic, check these five places.
Sender: Chelston at 222 Emails
Format: text-led, restrained HTML acceptable
CTA: Run the 5-point check

Copy:

Hi {{ first_name|default:'there' }},

A lot of businesses try to solve a revenue problem by buying more attention.

More ads. More traffic. More followers. More leads.

But before paying for another person to enter the funnel, I’d check what happens to the people already there.

Five places we look first:

1. New subscribers who never get a proper welcome.
2. Interested prospects who go quiet with no structured follow-up.
3. Customers who buy once and hear nothing relevant afterwards.
4. Lapsed customers who are never given a reason to return.
5. One-size-fits-all campaigns sent without useful segmentation.

If even one of those is happening, there may already be recoverable value sitting inside the existing audience.

That is the idea behind our Client Return System: improve what happens after attention has already been earned.

Take two minutes and score your business from 0 to 5.

How many of those five are genuinely covered today?

[CHECK MY EMAIL SYSTEM]

Chelston
222 Emails

P.S. A low score isn’t automatically bad news. It can mean there is obvious room to improve without needing to start by increasing ad spend.

### W03 What We Would Fix First
Subject A: What we’d fix first in your email system
Subject B: The order matters more than the number of emails
Preview: The 4-layer system we use before making anything prettier.
Format: designed portfolio email
CTA: See the 4-layer framework

Copy / content hierarchy:

Hero: MORE EMAILS ISN’T THE GOAL. A BETTER SYSTEM IS.
Subhead: Before we redesign a template, we work out where the customer journey is leaking attention, trust or revenue.

Layer 01, Capture
Are the right people joining the list, with clear consent and a compelling reason to stay?

Layer 02, Convert
Does the welcome and nurture journey move genuine interest towards the next useful action?

Layer 03, Return
Are customers and leads given relevant reasons to come back rather than being forgotten after the first interaction?

Layer 04, Learn
Are behaviour, segmentation and results feeding the next decision?

Callout: DESIGN SUPPORTS THE STRATEGY. IT DOESN’T REPLACE IT.

CTA: [SHOW ME WHAT YOU’D FIX]

Footer note: 222 Emails, outcome-led email systems for retention, reactivation and missed-revenue recovery.

### W04 Proof > Promises
Subject A: We built this instead of telling you we could
Subject B: Proof > promises
Preview: You’re inside the exact kind of system we sell.
Format: flagship designed email
CTA: Request a free audit

Copy / content hierarchy:

Hero: YOU’RE NOT READING OUR PORTFOLIO. YOU’RE INSIDE IT.

Most agencies can show you a mock-up.

We wanted to show you the system working.

This welcome journey was built as a live demonstration of how 222 Emails approaches lifecycle email:

STRATEGY
Every message has one job in the customer journey.

COPY
The message earns the next action instead of filling space.

DESIGN
Visual hierarchy makes the argument easier to understand, not harder.

SEGMENTATION
The right message should respond to who the reader is and what they have done.

MEASUREMENT
We care about movement towards qualified conversations and revenue, not vanity metrics in isolation.

Proof strip:
Email 01: establish trust
Email 02: diagnose the problem
Email 03: demonstrate the mechanism
Email 04: prove the capability
Email 05: convert intent

Callout: THIS IS WHAT “EMAIL AS A SYSTEM” LOOKS LIKE.

CTA: [REQUEST MY FREE EMAIL AUDIT]

Risk reversal: No generic 40-page report. We identify the highest-value opportunities we can substantiate and show what we would prioritise first.

### W05 Want Us To Find Yours?
Subject A: Want us to find the leaks?
Subject B: I can do this for your business next
Preview: One simple next step if you want us to look.
Sender: Chelston at 222 Emails
Format: founder-style text
CTA: Request audit

Copy:

Hi {{ first_name|default:'there' }},

Over the last few emails I’ve shown you how we think about email at 222 Emails.

Not “send more newsletters”.

Build a better system around the attention and customers the business already has.

If you want, the next example can be your business.

We’ll look for the most important opportunities across areas such as:

• welcome and nurture
• missed follow-up
• retention and repeat purchase
• reactivation
• segmentation
• deliverability and obvious friction

Then we’ll tell you what we would prioritise first and why.

[REQUEST MY FREE EMAIL AUDIT]

If there isn’t a meaningful opportunity we can substantiate, we shouldn’t manufacture one just to pitch you.

Chelston
Founder, 222 Emails

## Measurement hierarchy

Primary: audit requests, qualified leads, opportunities, clients and attributable pipeline/revenue.
Secondary: unique click rate, reply rate, conversion by message and unsubscribe/spam complaint signals.
Diagnostic only: opens, because privacy features can distort them.

## QA gates before Live

- Sending domain authenticated and aligned.
- From/reply-to address monitored.
- Consent and unsubscribe behaviour verified.
- Test profiles cover first-name present/missing.
- Every CTA resolves to the correct live destination.
- Mobile and desktop rendering checked.
- Dark mode checked for designed messages.
- Plain-text alternative checked.
- No broken variables.
- UTM naming standard applied.
- Client/audit-request exits tested.
- Flow starts in Manual/Draft until seed tests pass.

## API architecture

Klaviyo currently supports template creation through the Templates API and flow creation through the Flows API. Production deployment must use a private API key stored only as a GitHub secret named `KLAVIYO_PRIVATE_API_KEY`. Never commit the key.

The safest implementation is template-first deployment, then construct/clone the flow definition after the account list IDs, conversion event and destination URLs are known.

## Remaining live-account inputs

These cannot be safely invented:
1. Klaviyo private API key with the minimum required scopes.
2. Klaviyo list ID for the TTE lead/newsletter list.
3. Final audit CTA URL.
4. Confirmed sending address/domain and sender identity.
5. Definition of the audit conversion event if not already present.

Until those are supplied, this repository is deployment-ready but intentionally cannot activate or send email.