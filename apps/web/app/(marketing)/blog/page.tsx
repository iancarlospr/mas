import Link from 'next/link';
import type { Metadata } from 'next';
import { getAllPosts } from '@/lib/mdx';

export const metadata: Metadata = {
  title: 'Blog — UnderTheStack',
  description: 'Marketing technology insights, teardowns, and analysis.',
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <section className="py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h1 className="font-heading text-h1 text-primary mb-2">
          UnderTheStack
        </h1>
        <p className="text-lg text-muted mb-12">
          Marketing technology teardowns, insights, and analysis.
        </p>

        {posts.length === 0 ? (
          <p className="text-muted">No posts yet. Check back soon.</p>
        ) : (
          <div className="space-y-8">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="block bg-surface border border-border rounded-xl p-8 hover:shadow-lg hover:border-accent/20 transition-all"
              >
                <time className="text-xs text-muted">{post.date}</time>
                <h2 className="font-heading text-h3 text-primary mt-2 mb-2">
                  {post.title}
                </h2>
                <p className="text-muted text-sm">{post.excerpt}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
