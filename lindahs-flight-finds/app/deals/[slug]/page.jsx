import Image from 'next/image';
import Link from 'next/link';
import { deals, findDeal, money, saving } from '../../../data/deals';

export function generateStaticParams() {
  return deals.map((deal) => ({ slug: deal.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const deal = findDeal(slug);
  if (!deal) return { title: 'Deal not found' };
  return {
    title: `${deal.title} from ${money(deal.price)} | Lindah's Flight Finds`,
    description: `${deal.durationDays}-day itinerary idea for ${deal.to}. Sample fare from ${money(deal.price)}. Prices can change, always check before booking.`,
    openGraph: {
      title: `${deal.title} from ${money(deal.price)}`,
      description: deal.summary,
      images: [deal.image]
    }
  };
}

export default async function DealPage({ params }) {
  const { slug } = await params;
  const deal = findDeal(slug);

  if (!deal) {
    return (
      <main className="shell section">
        <h1>Deal not found</h1>
        <p>This sample deal is not available.</p>
        <Link className="btn btn-blue" href="/">Back to deals</Link>
      </main>
    );
  }

  return (
    <main className="shell section">
      <Link className="btn btn-soft" href="/">← Back to all deals</Link>
      <section className="section split">
        <div className="split-grid">
          <div className="split-photo">
            <Image src={deal.image} alt={`${deal.to} travel preview`} fill sizes="(max-width: 1100px) 100vw, 45vw" priority />
            <div className="overlay" />
            <div className="photo-content">
              <span className="badge soft">{deal.badge}</span>
              <div>
                <p className="mini">{deal.from} to</p>
                <h2>{deal.to}</h2>
                <p>{deal.lindahNote}</p>
              </div>
            </div>
          </div>
          <div className="split-content">
            <span className="badge orange">Curated deal page</span>
            <h1>{deal.title}</h1>
            <p>{deal.summary}</p>
            <div className="score-grid">
              <div className="score"><b>{money(deal.price)}</b><span>sample fare</span></div>
              <div className="score"><b>{money(saving(deal))}</b><span>sample saving</span></div>
              <div className="score"><b>{deal.score}</b><span>overall score</span></div>
              <div className="score"><b>{deal.risk}</b><span>risk score</span></div>
              <div className="score"><b>{deal.durationDays}</b><span>days</span></div>
            </div>
            <div className="two-col">
              <div className="panel"><h2>What Lindah checked</h2>{deal.checks.map((item) => <div className="check" key={item}>✓ {item}</div>)}</div>
              <div className="panel amber-panel"><h2>Before you click</h2><p>{deal.warning}</p><p><strong>Budget guide:</strong> {deal.budget}</p><p><strong>Disclosure:</strong> sample pricing only. Check the final provider page before booking.</p></div>
            </div>
          </div>
        </div>
      </section>
      <section className="section panel white">
        <h2>{deal.durationDays}-day itinerary</h2>
        {deal.itinerary.map(([day, title, body]) => (
          <div className="check" key={day}><strong>{day}: {title}</strong><br />{body}</div>
        ))}
        <div className="top-row pad-top">
          <Link className="btn btn-orange" href="/alerts">Get alerts for live versions of this deal</Link>
          <Link className="btn btn-soft" href="/affiliate-disclosure">Affiliate disclosure</Link>
        </div>
      </section>
    </main>
  );
}
