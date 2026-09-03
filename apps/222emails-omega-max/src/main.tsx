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
        <div><strong>222Emails</strong><p>Client Return Systems for appointment-led SMEs.</p></div>
        <div><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/cookies/">Cookies</a><a href="/accessibility/">Accessibility</a></div>
        <div><a href="mailto:hello@222emails.com">hello@222emails.com</a><p>UK</p></div>
      </div>
    </footer>
  </>;
}

function Journey() {
  const steps = [
    ['Enquiry', 'Interest is shown'],
    ['Booked', 'Appointment is scheduled'],
    ['Attended', 'Service is completed'],
    ['Rebooked', 'A useful next step exists'],
    ['Returned', 'The client comes back']
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
    '222Emails | Client Return Systems for Appointment-Led SMEs',
    '222Emails helps appointment-led businesses find where useful demand is losing momentum, then builds the smallest sensible Client Return System to tighten the gap.',
    'https://222emails.com/'
  ), []);

  return <Shell>
    <section className="hero section">
      <div className="wrap hero-grid">
        <div>
          <p className="eyebrow">FOR APPOINTMENT-LED BUSINESSES</p>
          <h1>Recover more from the enquiries and clients you already have.</h1>
          <p className="hero-copy">We find where useful demand may be losing momentum across enquiries, follow-up, no-shows, rebooking and win-back, then build the smallest sensible Client Return System to tighten the gap.</p>
          <div className="cta-row">
            <a className="button primary" href="/revenue-recovery-check">Get my Free Revenue Recovery Check</a>
            <a className="text-link" href="#how-it-works">See how it works</a>
          </div>
          <div className="trust-line"><span>Human-reviewed</span><span>No platform access required</span><span>No mandatory discovery call</span></div>
        </div>
        <aside className="hero-card" aria-label="Revenue Recovery Check summary">
          <p className="eyebrow">FREE DIAGNOSTIC</p>
          <h2>Start with the leak, not the software.</h2>
          <p>About 3 minutes to start. We review the journey and return one clear finding, one practical next step and an honest view on whether deeper paid work is justified.</p>
          <a className="button dark" href="/revenue-recovery-check">Start the free check</a>
          <small>No obligation to buy.</small>
        </aside>
      </div>
    </section>

    <section className="section muted">
      <div className="wrap">
        <p className="eyebrow">SOUND FAMILIAR?</p>
        <h2 className="section-title">Revenue often leaks after the lead arrives.</h2>
        <div className="problem-grid">
          <article><h3>Missed enquiries</h3><p>A useful enquiry arrives, but the first response is slow, inconsistent or forgotten.</p></article>
          <article><h3>Weak follow-up</h3><p>A quote or conversation goes quiet and no sensible second contact happens.</p></article>
          <article><h3>No-show recovery</h3><p>An appointment is missed and the slot, relationship and future value are left unmanaged.</p></article>
          <article><h3>Rebooking and win-back</h3><p>A client becomes due to return, but nobody owns the next step and the relationship fades.</p></article>
        </div>
      </div>
    </section>

    <section id="how-it-works" className="section">
      <div className="wrap">
        <p className="eyebrow">THE CLIENT RETURN JOURNEY</p>
        <h2 className="section-title">The technology may already exist. The commercial journey may still be unfinished.</h2>
        <p className="section-copy">222Emails does not start by replacing your booking platform, CRM or email tool. We diagnose whether the journey, configuration, messaging, permissions, handoffs and measurement are doing the job they should.</p>
        <Journey />
        <div className="principle-card"><strong>Existing tools first.</strong><span>We use the technology you already have wherever it can do the job properly. Additional implementation is recommended only where there is a real gap.</span></div>
      </div>
    </section>

    <section className="section navy-section">
      <div className="wrap two-col">
        <div>
          <p className="eyebrow light">WHAT GOOD LOOKS LIKE</p>
          <h2>Less remembering. More useful next steps.</h2>
        </div>
        <div className="outcomes">
          <p>Enquiries have an owner and a sensible follow-up path.</p>
          <p>No-shows do not disappear without a defined response.</p>
          <p>Clients approaching their natural return window can be identified.</p>
          <p>Human handoffs are explicit instead of trapped in someone’s memory.</p>
          <p>Commercial outcomes can be measured without pretending every message caused the result.</p>
        </div>
      </div>
    </section>

    <section id="proof" className="section">
      <div className="wrap">
        <p className="eyebrow">EVIDENCE BEFORE THEATRE</p>
        <h2 className="section-title">Proof should show the system around the message.</h2>
        <div className="proof-grid">
          <article><span className="proof-label">DELIVERY EVIDENCE</span><h3>Finished journey architecture</h3><p>Triggers, stop conditions, ownership, handoffs, permissions, QA and reporting are part of the deliverable, not an afterthought.</p></article>
          <article><span className="proof-label">CAPABILITY</span><h3>Klaviyo Deliverability certified</h3><p>Relevant platform capability is useful evidence of competence, but it is not presented as client revenue proof.</p></article>
          <article><span className="proof-label">BOUNDARY</span><h3>No invented dashboards or made-up ROI</h3><p>Illustrative material is labelled. Commercial claims are not upgraded beyond the evidence available.</p></article>
        </div>
      </div>
    </section>

    <section id="pricing" className="section muted">
      <div className="wrap">
        <p className="eyebrow">THE OFFER PATH</p>
        <h2 className="section-title">Start free. Go deeper only when the evidence justifies it.</h2>
        <div className="offer-grid">
          <article className="offer featured"><span>START HERE</span><h3>Free Revenue Recovery Check</h3><p>Human-reviewed diagnostic of the strongest identifiable issue and the first sensible next step.</p><strong>Free</strong><a className="button primary" href="/revenue-recovery-check">Start free</a></article>
          <article className="offer"><span>DEEPER DIAGNOSIS</span><h3>Revenue Recovery Growth Check</h3><p>Deeper analysis for businesses where the opportunity deserves more investigation before implementation.</p><strong>£197</strong><p className="small-note">Recommended only after the initial diagnosis when justified.</p></article>
          <article className="offer"><span>IMPLEMENTATION</span><h3>7-Day Client Return System Sprint</h3><p>A focused implementation sprint for an agreed scope, with dependencies, handoffs and QA made explicit.</p><strong>£997</strong><p className="small-note">The 7-day scope is defined before work begins. It is not a promise to transform every lifecycle process in a week.</p></article>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="wrap two-col founder-section">
        <div><p className="eyebrow">FOUNDER-LED</p><h2>Built for businesses that cannot rely on somebody remembering every follow-up.</h2></div>
        <div><p>222Emails is a founder-led client return systems practice. The work is deliberately practical: diagnose the commercial gap, use existing tools where sensible, build only what is needed, document it properly and make the next action clear.</p><p>No fake team page. No invented scale. No promise that automation replaces judgement.</p></div>
      </div>
    </section>

    <section className="section faq-section">
      <div className="wrap narrow">
        <p className="eyebrow">COMMON QUESTIONS</p>
        <h2 className="section-title">Before you start</h2>
        <details><summary>Is this just email marketing?</summary><p>No. Email can be one part of a Client Return System, but the diagnosis starts with the commercial journey. Depending on the gap, that can include booking software, CRM fields, SMS, email, human handoffs, permissions, reporting or a simpler operational fix.</p></details>
        <details><summary>Do I need to change my software?</summary><p>Not by default. We prefer to use your existing technology wherever it can do the job properly. Changing tools is a recommendation of last resort, not the starting point.</p></details>
        <details><summary>Do I need a sales call?</summary><p>No mandatory discovery call is required to start the Free Revenue Recovery Check. A call can be used later when it genuinely helps clarify a higher-value or more complex opportunity.</p></details>
        <details><summary>Do you guarantee revenue?</summary><p>No. Revenue depends on factors no responsible operator can control completely. We can define and QA the deliverables we control, but we do not fabricate certainty around commercial outcomes.</p></details>
      </div>
    </section>

    <section className="final-cta">
      <div className="wrap final-cta-inner"><div><p className="eyebrow light">START WITH THE EVIDENCE</p><h2>Find the strongest identifiable gap in your client return journey.</h2></div><a className="button light-button" href="/revenue-recovery-check">Get my Free Revenue Recovery Check</a></div>
    </section>
  </Shell>;
}

function RevenueRecoveryCheck() {
  useEffect(() => setMeta(
    'Free Revenue Recovery Check | 222Emails',
    'A human-reviewed diagnostic for appointment-led businesses. Find the strongest identifiable revenue-recovery issue and the first sensible next step.',
    'https://222emails.com/revenue-recovery-check'
  ), []);

  const formUrl = `${TALLY_URL}?landing_page=${encodeURIComponent(window.location.pathname)}&cta_location=revenue_recovery_check_page&form_version=2026-09-03`;

  return <Shell>
    <section className="rrc-hero section">
      <div className="wrap two-col rrc-grid">
        <div>
          <p className="eyebrow">FREE REVENUE RECOVERY CHECK</p>
          <h1>Find where useful demand may be losing momentum.</h1>
          <p className="hero-copy">For appointment-led businesses that want a clearer view of what may be happening after an enquiry arrives or a client finishes their appointment.</p>
          <ul className="check-list"><li>About 3 minutes to start</li><li>Human-reviewed</li><li>No platform access required</li><li>No mandatory discovery call</li><li>No obligation to buy</li></ul>
        </div>
        <div className="rrc-summary"><h2>What you receive</h2><ol><li>The strongest identifiable issue from the information provided</li><li>Why that issue matters commercially</li><li>Any material unknowns that limit certainty</li><li>The first sensible move we would recommend</li><li>An honest view on whether paid work appears justified</li></ol><p className="boundary">This is a focused diagnostic, not a disguised 15-page consultancy project and not a promise of recovered revenue.</p></div>
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
