import Link from "next/link";
import { deals, findDeal } from "../../../data/deals";

export function generateStaticParams() {
  return deals.map((deal) => ({ slug: deal.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const deal = findDeal(slug);
  if (!deal) return { title: "Itinerary not found" };

  return {
    title: `${deal.to} itinerary | Lindah's Flight Finds`,
    description: `${deal.durationDays}-day itinerary idea for ${deal.to}.`
  };
}

export default async function ItineraryPage({ params }) {
  const { slug } = await params;
  const deal = findDeal(slug);
  if (!deal) {
    return (
      <main className="shell section">
        <h1>Itinerary not found</h1>
        <Link className="btn btn-blue" href="/">Back home</Link>
      </main>
    );
  }

  return (
    <main className="shell section">
      <Link href="/" className="btn btn-soft">← Back home</Link>
      <section className="panel white section">
        <span className="badge orange">Itinerary-first</span>
        <h1>{deal.durationDays}-day {deal.to} itinerary</h1>
        <p>{deal.summary}</p>
        {deal.itinerary.map(([day, title, body]) => (
          <div className="check" key={day}>
            <strong>{day}: {title}</strong>
            <br />
            {body}
          </div>
        ))}
      </section>
    </main>
  );
}
