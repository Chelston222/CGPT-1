import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="shell section">
      <section className="panel white section">
        <h1>Page not found</h1>
        <p>This page does not exist yet. Go back to the main deal board and choose a curated trip.</p>
        <Link href="/" className="btn btn-blue">Back to deals</Link>
      </section>
    </main>
  );
}
