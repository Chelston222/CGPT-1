import Link from 'next/link';

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
        <p>Lindah's Flight Finds is a curated travel inspiration and deal-discovery website. It is not a travel agent, airline, hotel provider or booking platform.</p>
        <p>All prices shown in the prototype are sample figures. In production, visitors must verify the final price, terms, luggage rules, refund rules and availability with the booking provider before making a purchase.</p>
        <p>Lindah is not responsible for airline schedule changes, provider errors, visa or passport issues, cancellations, refunds, accommodation quality or third-party booking support.</p>
      </section>
    </main>
  );
}
