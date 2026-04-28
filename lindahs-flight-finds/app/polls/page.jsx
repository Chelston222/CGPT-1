import Link from 'next/link';
import { pollSeed } from '../../data/deals';

export const metadata = {
  title: "Travel Polls | Lindah's Flight Finds",
  description: "Vote on where Lindah should search for cheap-flight trips next."
};

export default function PollsPage() {
  const total = pollSeed.reduce((sum, item) => sum + item.votes, 0);
  return (
    <main className="shell section">
      <Link href="/" className="btn btn-soft">← Back home</Link>
      <section className="panel white section">
        <span className="badge green">Audience demand</span>
        <h1>Where should Lindah find deals next?</h1>
        <p>This static preview shows how audience demand can shape the next deal search.</p>
        <div className="content-grid">
          {pollSeed.map((item) => {
            const percent = Math.round((item.votes / total) * 100);
            return (
              <div className="panel" key={item.label}>
                <h2>{item.label}</h2>
                <p>{item.votes} votes</p>
                <p><strong>{percent}%</strong> of sample demand</p>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
