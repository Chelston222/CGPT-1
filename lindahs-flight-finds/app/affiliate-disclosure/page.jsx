import Link from 'next/link';

export const metadata = {
  title: "Affiliate Disclosure | Lindah's Flight Finds",
  description: "Affiliate and advertising disclosure for Lindah's Flight Finds."
};

export default function AffiliateDisclosurePage() {
  return (
    <main className="shell section">
      <Link href="/" className="btn btn-soft">← Back home</Link>
      <section className="panel white section">
        <h1>Affiliate Disclosure</h1>
        <p>Some links on Lindah&apos;s Flight Finds may be affiliate or referral links. This means Lindah may earn a commission if a visitor clicks through and completes a purchase, at no extra cost to the visitor.</p>
        <p>Flight prices, hotel prices and availability can change quickly. Visitors should always check the final provider page before booking.</p>
        <p>Any paid partnerships, sponsored features or affiliate-led recommendations should be clearly labelled where relevant.</p>
      </section>
    </main>
  );
}
