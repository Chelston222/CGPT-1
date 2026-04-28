import Link from 'next/link';
import { blogIdeas } from '../../data/deals';

export const metadata = {
  title: "Travel blog | Lindah's Flight Finds",
  description: "Cheap-flight planning, destination ideas and itinerary notes from Lindah's Flight Finds."
};

export default function BlogPage() {
  return (
    <main className="shell section">
      <Link href="/" className="btn btn-soft">← Back home</Link>
      <section className="panel white section">
        <p className="eyebrow-dark">SEO content hub</p>
        <h1>Travel blog ideas</h1>
        <p>This starter blog route gives Lindah a place to publish cheap-flight explainers, destination guides and itinerary planning posts.</p>
        <div className="content-grid">
          {blogIdeas.map((idea) => <div key={idea} className="panel"><h3>{idea}</h3><p>Draft this as a practical, audience-first guide with internal links to relevant deals.</p></div>)}
        </div>
      </section>
    </main>
  );
}
