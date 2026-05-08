import Link from "next/link";
import { blogPosts, findBlogPost } from "../../../data/deals";

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export function generateMetadata({ params }) {
  const post = findBlogPost(params.slug);
  if (!post) return { title: "Post not found" };

  return {
    title: `${post.title} | Lindah's Flight Finds`,
    description: post.summary
  };
}

export default function BlogPostPage({ params }) {
  const post = findBlogPost(params.slug);
  if (!post) {
    return (
      <main className="shell section">
        <h1>Post not found</h1>
        <Link className="btn btn-blue" href="/">Back home</Link>
      </main>
    );
  }

  return (
    <main className="shell section">
      <Link href="/" className="btn btn-soft">← Back home</Link>
      <section className="panel white section">
        <span className="badge blue">Editorial draft</span>
        <h1>{post.title}</h1>
        <p>{post.summary}</p>
        <div className="check">
          This route is intentionally scaffolded for launch readiness. The production version
          should turn this into a full audience-first guide with internal links to relevant deals,
          affiliate disclosure where appropriate, and a clear “prices change” note when a fare is referenced.
        </div>
      </section>
    </main>
  );
}
