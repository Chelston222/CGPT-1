import Link from 'next/link';

export const metadata = {
  title: "Privacy Policy | Lindah's Flight Finds",
  description: "Privacy notice for Lindah's Flight Finds."
};

export default function PrivacyPage() {
  return (
    <main className="shell section">
      <Link href="/" className="btn btn-soft">← Back home</Link>
      <section className="panel white section">
        <h1>Privacy Policy</h1>
        <p>This starter privacy notice is a placeholder for the launch preview. Before public promotion, it should be reviewed and updated with Lindah's real contact details, email provider, analytics provider and any affiliate or advertising partners.</p>
        <h2>What may be collected</h2>
        <p>If visitors join deal alerts, the production site may collect their email address, consent status, selected interests and signup source.</p>
        <h2>How data may be used</h2>
        <p>Data should only be used to send requested deal alerts, improve the service and measure site performance where legally permitted.</p>
        <h2>Marketing consent</h2>
        <p>Marketing emails should only be sent to people who have actively signed up or where a lawful soft opt-in applies. Consent should be recorded.</p>
      </section>
    </main>
  );
}
