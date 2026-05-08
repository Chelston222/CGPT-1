import Link from 'next/link';
import { appConfig } from '../../data/deals';

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
        <p>This privacy notice explains the expected data flows for Lindah&apos;s Flight Finds. It still needs final legal review before public promotion, but it is now structured around the actual site features rather than being a bare placeholder.</p>
        <p><strong>Contact:</strong> {appConfig.contactEmail}</p>
        <h2>What may be collected</h2>
        <p>If visitors join deal alerts, the site may collect their email address, optional first name, consent status, signup source, and timestamp of consent. The site may also log aggregated interaction events such as deal selection, compare actions, outbound click intent and alert signup attempts.</p>
        <h2>How data may be used</h2>
        <p>Data should only be used to send requested deal alerts, improve the service, measure site performance where legally permitted, and maintain compliance records for email consent and unsubscribe handling.</p>
        <h2>Marketing consent</h2>
        <p>Marketing emails should only be sent to people who have actively signed up or where a lawful soft opt-in applies. Consent should be recorded.</p>
        <h2>Third-party services</h2>
        <p>The production site may use a hosting provider, email provider, analytics tooling and affiliate or referral partners. These providers should only receive the minimum information needed to deliver the requested feature.</p>
        <h2>Retention and rights</h2>
        <p>Once the final provider stack is chosen, this page should be updated with the exact retention periods, lawful bases, unsubscribe process and rights-request contact process relevant to the chosen operating region.</p>
      </section>
    </main>
  );
}
