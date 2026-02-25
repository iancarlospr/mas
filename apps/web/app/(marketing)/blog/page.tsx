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
    <section className="py-gs-16">
      <div className="mx-auto max-w-4xl px-gs-4">
        <h1 className="font-system text-[clamp(24px,4vw,44px)] font-bold text-gs-ink mb-gs-2">
          UnderTheStack
        </h1>
        <p className="font-data text-data-lg text-gs-muted mb-gs-8">
          Marketing technology teardowns, insights, and analysis.
        </p>

        {posts.length === 0 ? (
          <p className="font-data text-data-sm text-gs-muted">No posts yet. Check back soon.</p>
        ) : (
          <div className="space-y-gs-6">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="block bevel-raised bg-gs-chrome p-gs-6 hover:shadow-ghost-glow transition-shadow"
              >
                <time className="font-data text-data-xs text-gs-muted">{post.date}</time>
                <h2 className="font-system text-os-lg font-bold text-gs-ink mt-gs-2 mb-gs-2">
                  {post.title}
                </h2>
                <p className="font-data text-data-sm text-gs-muted">{post.excerpt}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
