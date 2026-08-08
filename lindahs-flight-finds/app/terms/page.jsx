import Link from 'next/link';
import { appConfig } from '../../data/deals';

export const metadata = {
  title: "Terms | Lindah's Flight Finds",
  description: "Terms and disclaimers for Lindah's Flight Finds."
};

export default function TermsPage() {
  return (
    <main className="shell section">
      <Link href="/" className="btn btn-soft">← Back home</Link>
      <section className="panel white section">
        <h1>Terms and Disclaimer</h1>
        <p>Lindah&apos;s Flight Finds is a curated travel inspiration and deal-discovery website. It is not a travel agent, airline, hotel provider or booking platform.</p>
        <p>All prices shown in the prototype are sample figures. In production, visitors must verify the final price, terms, luggage rules, refund rules and availability with the booking provider before making a purchase.</p>
        <p>Lindah is not responsible for airline schedule changes, provider errors, visa or passport issues, cancellations, refunds, accommodation quality or third-party booking support.</p>
        <p><strong>Audience region:</strong> {appConfig.audienceRegion}</p>
        <h2>Referral and affiliate links</h2>
        <p>Some outbound links may be referral or affiliate links. Where this applies, the site should disclose this clearly and should not imply that a sample fare is guaranteed, current or exclusive unless it has been recently verified.</p>
        <h2>No live fare guarantee</h2>
        <p>Flight prices can change rapidly due to availability, baggage rules, seat selection costs, transfer choices and provider pricing logic. Visitors should always treat the headline fare as an indication rather than a promise unless the provider page confirms it.</p>
        <h2>Operational contact</h2>
        <p>Any final live version should include the correct operational contact details and complaint-handling process once those details are confirmed.</p>
      </section>
    </main>
  );
}
