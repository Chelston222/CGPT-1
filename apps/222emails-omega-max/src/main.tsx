import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const TALLY_URL = 'https://tally.so/r/44057b';

function setMeta(title: string, description: string, canonical: string) {
  document.title = title;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute('content', description);
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = canonical;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header">
      <div className="wrap nav-wrap">
        <a className="brand" href="/" aria-label="222Emails home">222Emails</a>
        <nav aria-label="Primary navigation">
          <a href="/retention-marketing-lancashire/">Retention marketing</a>
          <a href="/#how-it-works">How it works</a>
          <a href="/#proof">Proof</a>
          <a href="/#pricing">Pricing</a>
          <a className="nav-cta" href="/revenue-recovery-check">Free Recovery Check</a>
        </nav>
      </div>
    </header>
    <main id="main">{children}</main>
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div>
          <strong>222Emails</strong>
          <p>Turnkey Client Return Systems for appointment-led businesses.</p>
          <p>Based in Great Harwood, Lancashire. Serving appointment-led SMEs across the UK.</p>
        </div>
        <div>
          <a href="/retention-marketing-lancashire/">Retention marketing Lancashire</a>
          <a href="/client-return-systems/">Client Return Systems</a>
          <a href="/about-222emails/">About 222Emails</a>
          <a href="/privacy/">Privacy</a>
          <a href="/terms/">Terms</a>
          <a href="/cookies/">Cookies</a>
          <a href="/accessibility/">Accessibility</a>
        </div>
        <div>
          <a href="mailto:hello@222emails.com">hello@222emails.com</a>
          <a href="tel:+447516389856">+44 7516 389 856</a>
          <p>Great Harwood · Blackburn · Accrington · Lancashire · UK</p>
        </div>
      </div>
    </footer>
  </>;
}

function SystemPreview() {
  const rows = [
    ['Enquiry received', 'Follow-up path starts', 'Stop when booked or handed to staff'],
    ['Appointment attended', 'Return window begins', 'Wait until the next useful moment'],
    ['Return window reached', 'Rebooking prompt', 'Stop when rebooked'],
    ['Client becomes overdue', 'Reactivation path', 'Escalate, suppress or close appropriately']
  ];
  return <aside className="system-preview" aria-label="Illustrative Client Return System map">
    <div className="preview-topline">
      <span className="preview-dot" aria-hidden="true"></span>
      <span>Illustrative Client Return System</span>
    </div>
    <div className="preview-body">
      {rows.map(([moment, action, stop], index) => <div className="preview-row" key={moment}>
        <span className="preview-index">0{index + 1}</span>
        <div><strong>{moment}</strong><small>{action}</small><em>{stop}</em></div>
      </div>)}
    </div>
    <p className="preview-note">Example architecture only. Real triggers, timing and permissions are set around the business and its customers.</p>
  </aside>;
}

function Journey() {
  const steps = [
    ['Enquiry', 'Interest is shown'],
    ['Booked', 'Appointment is scheduled'],
    ['Attended', 'Service is completed'],
    ['Due back', 'The natural return window arrives'],
    ['Returned', 'The client books again']
  ];
  return <div className="journey" aria-label="Simplified client return journey">
    {steps.map(([name, note], i) => <React.Fragment key={name}>
      <div className="journey-step"><span className="journey-number">{i + 1}</span><strong>{name}</strong><small>{note}</small></div>
      {i < steps.length - 1 && <span className="journey-arrow" aria-hidden="true">→</span>}
    </React.Fragment>)}
  </div>;
}

function Home() {
  useEffect(() => setMeta(
    '222Emails | Client Return Systems for Appointment-Led Businesses',
    '222Emails builds turnkey Client Return Systems for appointment-led businesses, helping tighten follow-up, rebooking, client reactivation and revenue recovery across Lancashire and the UK.',
    'https://222emails.com/'
  ), []);

  return <Shell>
    <section className="hero section">
      <div className="wrap hero-grid">
        <div>
          <p className="eyebrow">CLIENT RETURN SYSTEMS · LANCASHIRE + UK</p>
          <h1>Bring more clients back before you spend more on finding new ones.</h1>
          <p className="hero-copy">222Emails builds turnkey Client Return Systems for appointment-led businesses. We tighten the gaps around cold enquiries, no-shows, rebooking and lapsed clients, then install the follow-up, automation, handoffs and measurement needed to keep more of the demand you already worked to create.</p>
          <div className="cta-row">
            <a className="button primary" href="/revenue-recovery-check">Get my Free Revenue Recovery Check</a>
            <a className="text-link" href="#how-it-works">See the system</a>
          </div>
          <div className="trust-line"><span>Based in Great Harwood, Lancashire</span><span>Founder-led</span><span>Human-reviewed</span><span>No mandatory discovery call</span></div>
        </div>
        <SystemPreview />
      </div>
    </section>

    <section className="proof-strip" aria-label="222Emails operating principles">
      <div className="wrap proof-strip-grid">
        <div><strong>Existing tools first</strong><span>No forced software migration</span></div>
        <div><strong>Commercial journey first</strong><span>Not another email template service</span></div>
        <div><strong>Stop logic included</strong><span>Automation should know when to stop</span></div>
        <div><strong>Evidence labelled</strong><span>No invented ROI or fake dashboards</span></div>
      </div>
    </section>

    <section className="section muted">
      <div className="wrap">
        <p className="eyebrow">THE LEAK IS OFTEN AFTER ACQUISITION</p>
        <h2 className="section-title">You may already have the next bookings. They are just sitting in the gaps.</h2>
        <p className="section-copy">Before buying more attention, we look at what happens to the demand already inside the business.</p>
        <div className="problem-grid">
          <article><span className="card-number">01</span><h3>Cold enquiries</h3><p>Someone asks, considers or requests a quote, then the useful second contact never happens.</p></article>
          <article><span className="card-number">02</span><h3>No-shows and cancellations</h3><p>A missed appointment becomes a lost relationship because there is no defined recovery path.</p></article>
          <article><span className="card-number">03</span><h3>Missed rebooking</h3><p>A happy client leaves without a clear next step and nobody owns the natural return window.</p></article>
          <article><span className="card-number">04</span><h3>Lapsed clients</h3><p>Good customers drift outside their normal return pattern and stay invisible in the database.</p></article>
        </div>
      </div>
    </section>

    <section id="how-it-works" className="section">
      <div className="wrap">
        <p className="eyebrow">THE CLIENT RETURN JOURNEY</p>
        <h2 className="section-title">Retention is not a pile of messages. It is a system around the next useful customer moment.</h2>
        <p className="section-copy">222Emails maps what happened, what should happen next, what should trigger the journey, what should stop it, who owns the handoff and how the outcome is measured.</p>
        <Journey />
        <div className="principle-card"><strong>Booking software is not the strategy.</strong><span>We use the CRM, booking platform, email, SMS and operational tools already in place wherever they can do the job properly. New software is recommended only when a real gap requires it.</span></div>
      </div>
    </section>

    <section className="section navy-section">
      <div className="wrap">
        <p className="eyebrow light">WHAT GETS BUILT</p>
        <h2 className="section-title light-title">One Client Return System can close several different revenue leaks.</h2>
        <div className="mechanism-grid">
          <article><span>01</span><h3>Enquiry recovery</h3><p>Defined next steps for leads that have not booked yet.</p></article>
          <article><span>02</span><h3>Rebooking windows</h3><p>Follow-up around when a client would naturally be due back.</p></article>
          <article><span>03</span><h3>No-show recovery</h3><p>A clear path after a missed or cancelled appointment.</p></article>
          <article><span>04</span><h3>Client reactivation</h3><p>Relevant win-back journeys for customers who have genuinely lapsed.</p></article>
          <article><span>05</span><h3>Human handoffs</h3><p>Clear ownership when staff should take over from automation.</p></article>
          <article><span>06</span><h3>Measurement and QA</h3><p>Triggers, stop rules, suppression, reporting and testing documented properly.</p></article>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="wrap">
        <p className="eyebrow">THE BUILD METHOD</p>
        <h2 className="section-title">Diagnose the leak. Value the opportunity. Build only what earns its place.</h2>
        <div className="method-grid">
          <article><strong>1</strong><h3>Find the leak</h3><p>Map where enquiries, clients or repeat-booking opportunities are dropping out.</p></article>
          <article><strong>2</strong><h3>Understand why</h3><p>Separate messaging problems from timing, data, process, permissions or ownership problems.</p></article>
          <article><strong>3</strong><h3>Prioritise value</h3><p>Work on the highest-value supportable opportunity first instead of rebuilding everything.</p></article>
          <article><strong>4</strong><h3>Install the system</h3><p>Build the agreed journeys, handoffs, messages, automation, measurement and documentation.</p></article>
          <article><strong>5</strong><h3>QA and improve</h3><p>Test the logic, watch the real outcomes and improve what the evidence says deserves attention.</p></article>
        </div>
      </div>
    </section>

    <section className="section compare-section">
      <div className="wrap two-col compare-grid">
        <div>
          <p className="eyebrow">BEFORE MORE LEADS</p>
          <h2>Acquisition fills the top. A Client Return System protects what happens next.</h2>
          <p>More traffic can help. But if existing enquiries and clients keep falling out of the journey, buying more demand can simply feed the same leak.</p>
          <a className="text-link" href="/client-return-systems/">See what a Client Return System includes</a>
        </div>
        <div className="comparison-card">
          <div><span>More acquisition</span><strong>Creates new demand</strong><small>Useful when the return journey is ready to keep more of it.</small></div>
          <div className="versus">+</div>
          <div className="comparison-highlight"><span>Client Return System</span><strong>Works harder on demand already created</strong><small>Follow-up, rebooking, reactivation, handoffs and measurement.</small></div>
        </div>
      </div>
    </section>

    <section id="proof" className="section">
      <div className="wrap">
        <p className="eyebrow">PROOF WITHOUT THEATRE</p>
        <h2 className="section-title">Specific evidence beats a made-up percentage.</h2>
        <p className="section-copy">222Emails is still building the permission-cleared commercial proof base for this appointment-led offer. Until a result is verified and publishable, we show what can be proven without upgrading capability into a claim.</p>
        <div className="proof-grid">
          <article><span className="proof-label">CAPABILITY</span><h3>Klaviyo Deliverability certified</h3><p>Relevant platform competence for lifecycle and retention work, presented as capability evidence rather than client revenue proof.</p></article>
          <article><span className="proof-label">DELIVERY STANDARD</span><h3>System architecture, not isolated copy</h3><p>Journeys include triggers, stop conditions, ownership, handoffs, permissions, QA, reporting and documentation.</p></article>
          <article><span className="proof-label">EVIDENCE STANDARD</span><h3>Verified, estimated, illustrative or unknown</h3><p>Commercial evidence is labelled. Illustrative system maps are not passed off as live client dashboards.</p></article>
        </div>
        <div className="proof-next"><strong>What gets added next:</strong><span>Permission-cleared appointment-led case studies, on-time implementation evidence and event-backed commercial outcomes as soon as they meet the evidence standard.</span></div>
      </div>
    </section>

    <section className="section muted">
      <div className="wrap">
        <p className="eyebrow">BUILT AROUND APPOINTMENT BEHAVIOUR</p>
        <h2 className="section-title">Different businesses need different return logic.</h2>
        <div className="industry-grid">
          <a href="/client-retention-salons-barbers-lancashire/"><span>Salons & barbers</span><strong>Rebooking, quiet-slot recovery and lapsed regulars</strong><small>Explore the return journey →</small></a>
          <a href="/client-reactivation-aesthetics-lancashire/"><span>Aesthetics & skin clinics</span><strong>Treatment-aware return windows, enquiries and reactivation</strong><small>Explore the return journey →</small></a>
          <a href="/patient-reactivation-dental-lancashire/"><span>Dental practices</span><strong>Recall, missed appointments and treatment follow-up</strong><small>Explore the return journey →</small></a>
          <a href="/retention-marketing-lancashire/"><span>Other appointment-led SMEs</span><strong>Retention marketing built around the real customer journey</strong><small>Explore Lancashire retention →</small></a>
        </div>
      </div>
    </section>

    <section className="local-band section">
      <div className="wrap two-col">
        <div><p className="eyebrow light">LOCAL ROOTS, UK DELIVERY</p><h2>Based in Great Harwood. Built to become Lancashire's clearest appointment-retention specialist.</h2></div>
        <div><p>222Emails is based in Great Harwood, Lancashire and serves appointment-led businesses across Blackburn, Accrington, Hyndburn, wider Lancashire and the UK. Work can be delivered remotely, so geography does not limit the system.</p><a className="button light-button" href="/retention-marketing-lancashire/">Retention marketing in Lancashire</a></div>
      </div>
    </section>

    <section id="pricing" className="section">
      <div className="wrap">
        <p className="eyebrow">THE OFFER PATH</p>
        <h2 className="section-title">Start with diagnosis. Pay for depth only when the evidence justifies it.</h2>
        <div className="offer-grid offer-grid-four">
          <article className="offer featured"><span>START HERE</span><h3>Free Revenue Recovery Check</h3><p>A focused, human-reviewed first diagnosis of the strongest identifiable issue and the first sensible next step.</p><strong>Free</strong><a className="button primary" href="/revenue-recovery-check">Start free</a></article>
          <article className="offer"><span>DEEPER DIAGNOSIS</span><h3>Client Return Growth Check</h3><p>Evidence-led diagnosis when the opportunity deserves deeper investigation before implementation.</p><strong>£197</strong><p className="small-note">Recommended only when the initial finding justifies it.</p></article>
          <article className="offer"><span>IMPLEMENTATION</span><h3>7-Day Client Return System Sprint</h3><p>Install two focused repeat-booking or reactivation assets within the agreed scope, subject to access, readiness and approvals.</p><strong>£997</strong><p className="small-note">Scope and dependencies are agreed before the seven-working-day build begins.</p></article>
          <article className="offer"><span>ONGOING</span><h3>Optimisation</h3><p>Monitor, repair, test and improve suitable live systems, including Revenue Recovery Watch where scoped.</p><strong>£595/mo</strong><p className="small-note">Prescribed after diagnosis or implementation when ongoing work is justified.</p></article>
        </div>
      </div>
    </section>

    <section className="section founder-section-wrap">
      <div className="wrap two-col founder-section">
        <div><p className="eyebrow">FOUNDER-LED</p><h2>No junior handoff. No generic agency bundle.</h2></div>
        <div><p>222Emails is a founder-led client return systems practice. The job is deliberately narrow: find where the journey is leaking, use the existing stack where sensible, build the smallest useful recovery system, document it properly and make the next action clear.</p><p>The goal is not to make a client permanently dependent on 222Emails. The goal is to leave behind a system the business can understand, operate and improve.</p><a className="text-link" href="/about-222emails/">About 222Emails and Chelston →</a></div>
      </div>
    </section>

    <section className="section faq-section">
      <div className="wrap narrow">
        <p className="eyebrow">COMMON QUESTIONS</p>
        <h2 className="section-title">Before you start</h2>
        <details><summary>Is this just email marketing?</summary><p>No. Email can be one part of a Client Return System, but the diagnosis starts with the commercial journey. Depending on the gap, that can include booking software, CRM fields, SMS, email, human handoffs, permissions, reporting or a simpler operational fix.</p></details>
        <details><summary>Do I need to change my software?</summary><p>Not by default. We prefer to use your existing technology wherever it can do the job properly. Changing tools is a recommendation of last resort, not the starting point.</p></details>
        <details><summary>Do you only work in Lancashire?</summary><p>No. 222Emails is based in Great Harwood, Lancashire and works with suitable appointment-led businesses across the UK. Most system work can be delivered remotely.</p></details>
        <details><summary>Do I need a sales call?</summary><p>No mandatory discovery call is required to start the Free Revenue Recovery Check. A short call can be used later when it genuinely helps clarify a higher-value or more complex opportunity.</p></details>
        <details><summary>Do you guarantee revenue?</summary><p>No. Revenue depends on factors no responsible operator can control completely. We can define and QA the deliverables we control, but we do not fabricate certainty around commercial outcomes.</p></details>
      </div>
    </section>

    <section className="final-cta">
      <div className="wrap final-cta-inner"><div><p className="eyebrow light">START WITH THE EVIDENCE</p><h2>Find the strongest gap between the client you already earned and the booking that never came back.</h2></div><a className="button light-button" href="/revenue-recovery-check">Get my Free Revenue Recovery Check</a></div>
    </section>
  </Shell>;
}

function RevenueRecoveryCheck() {
  useEffect(() => setMeta(
    'Free Revenue Recovery Check | 222Emails',
    'A human-reviewed diagnostic for appointment-led businesses. Find the strongest identifiable revenue-recovery issue and the first sensible next step.',
    'https://222emails.com/revenue-recovery-check'
  ), []);

  const formUrl = `${TALLY_URL}?landing_page=${encodeURIComponent(window.location.pathname)}&cta_location=revenue_recovery_check_page&form_version=2026-09-14`;

  return <Shell>
    <section className="rrc-hero section">
      <div className="wrap two-col rrc-grid">
        <div>
          <p className="eyebrow">FREE REVENUE RECOVERY CHECK</p>
          <h1>Find the strongest leak in the journey you already paid to create.</h1>
          <p className="hero-copy">For appointment-led businesses that want a clearer view of what may be happening after an enquiry arrives or a client finishes their appointment.</p>
          <ul className="check-list"><li>About 3 minutes to start</li><li>Human-reviewed</li><li>No platform access required</li><li>No mandatory discovery call</li><li>No obligation to buy</li></ul>
        </div>
        <div className="rrc-summary"><h2>What you receive</h2><ol><li>The strongest identifiable issue from the information provided</li><li>Why that issue matters commercially</li><li>Any material unknowns that limit certainty</li><li>The first sensible move we would recommend</li><li>An honest view on whether paid work appears justified</li></ol><p className="boundary">This is a focused diagnostic, not a disguised consultancy project and not a promise of recovered revenue.</p></div>
      </div>
    </section>

    <section className="section muted">
      <div className="wrap">
        <p className="eyebrow">WHAT WE LOOK FOR</p>
        <div className="problem-grid"><article><h3>Enquiry response</h3><p>Where useful demand can stall before a booking happens.</p></article><article><h3>Follow-up</h3><p>Where a quote or conversation can fade without a sensible next step.</p></article><article><h3>No-show recovery</h3><p>Whether missed appointments have a defined recovery path.</p></article><article><h3>Rebooking and win-back</h3><p>Whether due-to-return and lapsed clients are identified and handled.</p></article></div>
      </div>
    </section>

    <section className="section form-section">
      <div className="wrap narrow">
        <p className="eyebrow">START THE CHECK</p>
        <h2 className="section-title">Tell us enough to diagnose the journey.</h2>
        <p className="section-copy">The form opens securely in Tally. Your diagnostic submission does not automatically subscribe you to marketing.</p>
        <div className="form-card">
          <a className="button primary large" href={formUrl} target="_blank" rel="noreferrer">Start my Free Revenue Recovery Check</a>
          <p>Prefer a direct link? <a href={TALLY_URL} target="_blank" rel="noreferrer">Open the form here.</a></p>
          <small>Do not include passwords, payment details or unnecessary sensitive personal information.</small>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="wrap narrow">
        <p className="eyebrow">WHAT HAPPENS NEXT</p>
        <h2 className="section-title">Prescription after diagnosis.</h2>
        <ol className="next-steps"><li>We review the client journey you describe.</li><li>We identify the strongest issue we can support from the evidence available.</li><li>We return the finding, the boundary and a practical next action.</li><li>If deeper work looks justified, we explain the relevant paid route. If it does not, we say so.</li></ol>
      </div>
    </section>
  </Shell>;
}

function ThankYou() {
  useEffect(() => setMeta(
    'Revenue Recovery Check Received | 222Emails',
    'Your 222Emails Revenue Recovery Check information has been received.',
    'https://222emails.com/revenue-recovery-check/thank-you'
  ), []);
  return <Shell><section className="section thank-you"><div className="wrap narrow"><div className="success-mark" aria-hidden="true">✓</div><p className="eyebrow">RECEIVED</p><h1>Thanks. Your Revenue Recovery Check is in.</h1><p className="hero-copy">The next step is review, not an automatic sales pitch. We will assess the information provided, identify the strongest supportable finding and tell you what we would do next.</p><a className="button dark" href="/">Back to 222Emails</a></div></section></Shell>;
}

function NotFound() {
  useEffect(() => setMeta('Page not found | 222Emails', 'The page you requested could not be found.', 'https://222emails.com/404'), []);
  return <Shell><section className="section thank-you"><div className="wrap narrow"><p className="eyebrow">404</p><h1>This page is not part of the current 222Emails journey.</h1><p className="hero-copy">Return to the homepage or start the Free Revenue Recovery Check.</p><div className="cta-row"><a className="button dark" href="/">Homepage</a><a className="button primary" href="/revenue-recovery-check">Free Recovery Check</a></div></div></section></Shell>;
}

function App() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  if (path === '/') return <Home />;
  if (path === '/revenue-recovery-check') return <RevenueRecoveryCheck />;
  if (path === '/revenue-recovery-check/thank-you') return <ThankYou />;
  return <NotFound />;
}

createRoot(document.getElementById('root')!).render(<App />);
