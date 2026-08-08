import Link from 'next/link';
import AlertsSignupForm from '../../components/AlertsSignupForm';

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
        <h1>Get Lindah&apos;s best finds first</h1>
        <p>The form below is wired to the site signup backend. Once provider credentials are added, signups can flow into the live audience system without changing the UI.</p>
        <AlertsSignupForm source="alerts-page" />
        <p><strong>Consent note:</strong> deal alerts should only be sent to people who actively sign up or where a lawful soft opt-in applies.</p>
      </section>
    </main>
  );
}
