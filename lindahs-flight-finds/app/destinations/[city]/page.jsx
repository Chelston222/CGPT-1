import Link from "next/link";
import { deals, findDealsByCity, money } from "../../../data/deals";

export function generateStaticParams() {
  return [...new Set(deals.map((deal) => deal.to.toLowerCase()))].map((city) => ({ city }));
}

export function generateMetadata({ params }) {
  const cityDeals = findDealsByCity(params.city);
  const label = cityDeals[0]?.to || params.city;

  return {
    title: `${label} deals | Lindah's Flight Finds`,
    description: `Sample cheap-flight ideas and trip planning notes for ${label}.`
  };
}

export default function DestinationPage({ params }) {
  const cityDeals = findDealsByCity(params.city);
  const label = cityDeals[0]?.to || params.city;

  return (
    <main className="shell section">
      <Link href="/" className="btn btn-soft">← Back home</Link>
      <section className="panel white section">
        <span className="badge blue">Destination view</span>
        <h1>{label}</h1>
        <p>These are the current sample deals and itinerary hooks for {label}.</p>
        <div className="content-grid">
          {cityDeals.map((deal) => (
            <div className="panel" key={deal.id}>
              <h2>{deal.title}</h2>
              <p>{money(deal.price)} • {deal.durationDays}-day plan • {deal.type}</p>
              <Link className="btn btn-blue" href={`/deals/${deal.slug}`}>Open deal</Link>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
