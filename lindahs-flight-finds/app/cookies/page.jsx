import Link from 'next/link';

export const metadata = {
  title: "Cookie Policy | Lindah's Flight Finds",
  description: "Cookie policy for Lindah's Flight Finds."
};

export default function CookiePolicyPage() {
  return (
    <main className="shell section">
      <Link href="/" className="btn btn-soft">← Back home</Link>
      <section className="panel white section">
        <h1>Cookie Policy</h1>
        <p>This starter cookie policy is included for launch planning. The preview build should avoid non-essential tracking until a consent approach has been chosen.</p>
        <p>In production, cookies may be used for analytics, saved trips, affiliate tracking and performance measurement. Visitors should be told what is used and given appropriate choices where required.</p>
        <p>Before launch, connect this page to the actual analytics, email and affiliate tools used by Lindah's Flight Finds.</p>
      </section>
    </main>
  );
}
