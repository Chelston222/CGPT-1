import Link from 'next/link';
import { deals } from '../../data/deals';

export const metadata = {
  title: "Itineraries | Lindah's Flight Finds",
  description: "Browse sample itinerary-led cheap-flight trip ideas."
};

export default function ItinerariesPage() {
  return (
    <main className="shell section">
      <Link href="/" className="btn btn-soft">← Back home</Link>
      <section className="panel white section">
        <span className="badge orange">Itinerary-first</span>
        <h1>Itineraries</h1>
        <p>These itinerary previews turn cheap fares into trips people can understand and share.</p>
        <div className="content-grid">
          {deals.map((deal) => (
            <div className="panel" key={deal.id}>
              <h2>{deal.to}</h2>
              <p>{deal.durationDays}-day plan from {deal.from}</p>
              <Link className="btn btn-blue" href={`/deals/${deal.slug}`}>View deal</Link>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
