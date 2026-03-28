'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface PostMeta {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
}

function formatDateCompact(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function MobileBlogSection() {
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/blog')
      .then((r) => r.json())
      .then((data: PostMeta[]) => setPosts(data.slice(0, 3)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-gs-6 pt-gs-3 pb-gs-6">
      {/* Masthead */}
      <div className="text-center space-y-gs-2 pb-gs-4">
        <h2
          className="font-display"
          style={{
            fontSize: 'clamp(24px, 6vw, 32px)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: 'var(--gs-base)',
          }}
        >
          UnderTheStack
        </h2>
        <p className="font-data text-data-xs text-gs-muted">
          Marketing technology teardowns.
        </p>
      </div>

      {/* Gradient separator */}
      <div
        className="h-[2px] mb-gs-4"
        style={{
          background:
            'linear-gradient(to right, var(--gs-base), oklch(0.35 0.05 340 / 0.2), transparent)',
        }}
      />

      {/* Content */}
      {loading ? (
        <div className="space-y-4 pt-2">
          {[65, 80, 55].map((w, i) => (
            <div
              key={i}
              className="skeleton h-[20px] rounded"
              style={{ width: `${w}%`, animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <p
          className="font-marker text-[16px] text-center py-gs-6"
          style={{ color: 'var(--gs-mid)' }}
        >
          Nothing here yet. Chloe is still writing.
        </p>
      ) : (
        <>
          <div>
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="block py-4"
                style={{ borderBottom: '1px solid oklch(0.35 0.05 340 / 0.1)' }}
              >
                <time
                  className="font-data text-[12px] uppercase tracking-[0.06em] block mb-1.5"
                  style={{ color: 'var(--gs-mid)' }}
                >
                  {formatDateCompact(post.date)}
                </time>
                <span
                  className="font-system text-[15px] leading-snug block"
                  style={{ color: 'var(--gs-light)' }}
                >
                  {post.title}
                </span>
                <span
                  className="font-data text-[13px] leading-relaxed mt-1.5 block line-clamp-2"
                  style={{ color: 'oklch(0.35 0.05 340 / 0.7)' }}
                >
                  {post.excerpt}
                </span>
              </Link>
            ))}
          </div>

          {/* View all link */}
          <div className="pt-gs-4 text-center">
            <Link
              href="/blog"
              className="font-data text-data-xs inline-flex items-center gap-1"
              style={{ color: 'var(--gs-base)' }}
            >
              View all posts
              <span className="text-[11px]">→</span>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
