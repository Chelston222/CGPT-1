import Link from 'next/link';
import { getLaunchStatus } from '../../lib/launch.js';

export const metadata = {
  title: "Launch Status | Lindah's Flight Finds",
  description: "Internal launch readiness checklist for Lindah's Flight Finds."
};

export default function LaunchStatusPage() {
  const { checks, blockers, audienceReady, audienceRegion } = getLaunchStatus();

  return (
    <main className="shell section">
      <Link href="/" className="btn btn-soft">← Back home</Link>
      <section className="panel white section">
        <span className={`badge ${audienceReady ? 'green' : 'orange'}`}>
          {audienceReady ? 'Audience-ready core is configured' : 'Still blocked before public launch'}
        </span>
        <h1>Launch status</h1>
        <p>
          This page is for operators, not the public audience. It shows which essentials are
          configured in the environment and which remaining steps still need human access,
          provider accounts or legal sign-off.
        </p>
        <p><strong>Audience region:</strong> {audienceRegion}</p>
        <div className="content-grid pad-top">
          {checks.map((check) => (
            <div className="panel" key={check.id}>
              <h2>{check.pass ? 'Ready' : 'Needs work'}</h2>
              <p><strong>{check.label}</strong></p>
              <p>{check.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel white section">
        <span className="badge blue">Human-required steps</span>
        <h2>What still needs you</h2>
        <div className="check">Deploy or connect the Vercel project and set the production environment variables.</div>
        <div className="check">Confirm the real contact inbox and the final public domain.</div>
        <div className="check">Choose the live email stack, such as Resend plus an audience or a webhook destination.</div>
        <div className="check">Complete legal review for privacy, terms, cookies and affiliate disclosures.</div>
        <div className="check">Approve the outbound monetisation route, whether affiliate links, referral links or email-first lead capture.</div>
      </section>

      {blockers.length > 0 && (
        <section className="panel white section">
          <span className="badge orange">Blocking items</span>
          <h2>These block a serious public launch today</h2>
          {blockers.map((check) => (
            <div className="check" key={check.id}>
              <strong>{check.label}:</strong> {check.detail}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
