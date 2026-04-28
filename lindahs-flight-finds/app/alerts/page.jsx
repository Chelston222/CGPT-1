import Link from 'next/link';

export const metadata = {
  title: "Deal Alerts | Lindah's Flight Finds",
  description: "Join Lindah's Flight Finds deal alerts."
};

export default function AlertsPage() {
  return (
    <main className="shell section">
      <Link href="/" className="btn btn-soft">← Back home</Link>
      <section className="panel white section">
        <span className="badge blue">Deal alerts</span>
        <h1>Get Lindah's best finds first</h1>
        <p>This is the static preview page for deal alerts. In production, this should connect to the chosen email platform and capture consent clearly.</p>
        <div className="search-grid">
          <label className="field"><span>Email</span><input placeholder="Enter email address" /></label>
          <button className="btn btn-orange">Join list</button>
        </div>
        <p><strong>Consent note:</strong> deal alerts should only be sent to people who actively sign up or where a lawful soft opt-in applies.</p>
      </section>
    </main>
  );
}
