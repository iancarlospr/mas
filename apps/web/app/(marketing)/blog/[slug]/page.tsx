import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { getPostBySlug, getAllSlugs } from '@/lib/mdx';

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: 'Post Not Found' };
  return {
    title: post.title,
    description: post.excerpt,
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) notFound();

  return (
    <article className="py-gs-16">
      <div className="mx-auto max-w-3xl px-gs-4">
        <Link href="/blog" className="font-data text-data-sm text-gs-red hover:underline mb-gs-6 inline-block">
          &larr; Back to blog
        </Link>
        <time className="block font-data text-data-xs text-gs-muted mb-gs-4">{post.date}</time>
        <h1 className="font-system text-[clamp(24px,4vw,44px)] font-bold text-gs-ink mb-gs-8">
          {post.title}
        </h1>
        <div className="prose prose-lg max-w-none font-data text-data-sm text-gs-muted leading-relaxed">
          <MDXRemote source={post.content} />
        </div>
      </div>
    </article>
  );
}
