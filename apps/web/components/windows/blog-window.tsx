'use client';

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, useInView, useReducedMotion } from 'framer-motion';

/* ═══════════════════════════════════════════════════════════════
   UnderTheStack — Hacker Zine Blog Window

   Two views:
   1. Post list — clean TOC with staggered entrance
   2. Post detail — reading progress, styled markdown, scroll reveals
   ═══════════════════════════════════════════════════════════════ */

interface PostMeta {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
}

interface PostFull extends PostMeta {
  content: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateCompact(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// ─── Animated Wrapper for scroll-reveal ──────────────────────
function ScrollReveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' as `${number}px` });
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={prefersReduced ? false : { opacity: 0, y: 6 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

// ─── H2 with slide-from-left animation ──────────────────────
function AnimatedH2({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' as `${number}px` });
  const prefersReduced = useReducedMotion();

  return (
    <motion.h2
      ref={ref}
      className="font-display text-[24px] uppercase tracking-wider mt-14 mb-5 pl-4"
      style={{ color: 'var(--gs-light)', borderLeft: '3px solid var(--gs-base)' }}
      initial={prefersReduced ? false : { opacity: 0, x: -10 }}
      animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {children}
    </motion.h2>
  );
}

// ─── Framer Motion variants for list stagger ─────────────────
const listContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const listItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

// ═══════════════════════════════════════════════════════════════
//  Main Component
// ═══════════════════════════════════════════════════════════════

export default function BlogWindow() {
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [activePost, setActivePost] = useState<PostFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPost, setLoadingPost] = useState(false);
  const [progress, setProgress] = useState(0);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();

  // Fetch post list on mount
  useEffect(() => {
    fetch('/api/blog')
      .then((r) => r.json())
      .then((data: PostMeta[]) => setPosts(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Open a post
  const openPost = useCallback(async (slug: string) => {
    setLoadingPost(true);
    try {
      const res = await fetch(`/api/blog/${slug}`);
      if (res.ok) {
        const post: PostFull = await res.json();
        setActivePost(post);
        setView('detail');
        setProgress(0);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingPost(false);
    }
  }, []);

  // Back to list
  const goBack = useCallback(() => {
    setView('list');
    setTimeout(() => setActivePost(null), 200);
  }, []);

  // Track reading progress on the parent .window-content scroller
  useEffect(() => {
    if (view !== 'detail') return;
    const el = containerRef.current?.closest('.window-content') as HTMLElement | null;
    if (!el) return;
    const onScroll = () => {
      const scrollable = el.scrollHeight - el.clientHeight;
      if (scrollable <= 0) { setProgress(100); return; }
      setProgress(Math.min((el.scrollTop / scrollable) * 100, 100));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    // Reset scroll to top when entering detail view
    el.scrollTop = 0;
    return () => el.removeEventListener('scroll', onScroll);
  }, [view]);

  // ─── Post Detail View ──────────────────────────────────────
  if (view === 'detail' && activePost) {
    return (
      <div ref={containerRef}>
        {/* Sticky top bar with back + progress — sticks inside .window-content */}
        <div
          className="sticky top-0 z-10"
          style={{ background: 'oklch(0.08 0.005 340 / 0.92)', backdropFilter: 'blur(8px)' }}
        >
          <div className="flex items-center justify-between px-5 py-2.5">
            <button
              onClick={goBack}
              className="font-data text-[13px] group flex items-center gap-1.5 transition-colors"
              style={{ color: 'var(--gs-base)' }}
            >
              <span className="inline-block transition-transform group-hover:-translate-x-0.5">←</span>
              <span className="relative">
                back
                <span
                  className="absolute left-0 -bottom-px h-px w-0 group-hover:w-full transition-all duration-200"
                  style={{ background: 'var(--gs-base)' }}
                />
              </span>
            </button>
          </div>
          {/* Progress bar */}
          <div className="h-[2px] w-full" style={{ background: 'oklch(0.15 0.02 340)' }}>
            <div
              className="h-full transition-[width] duration-100 ease-linear"
              style={{
                width: `${progress}%`,
                background: 'var(--gs-base)',
                boxShadow: progress > 0 ? '0 0 6px var(--gs-base)' : 'none',
              }}
            />
          </div>
          <div className="h-px" style={{ background: 'oklch(0.35 0.05 340 / 0.1)' }} />
        </div>

        {/* Post content — flows naturally, .window-content scrolls */}
        <div className="px-6 py-6">
          {/* Post header */}
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            {/* Date pill */}
            <span
              className="inline-block font-data text-[12px] uppercase tracking-[0.1em] px-3 py-1 rounded-full mb-5"
              style={{
                color: 'var(--gs-base)',
                border: '1px solid oklch(0.82 0.15 340 / 0.3)',
                background: 'oklch(0.82 0.15 340 / 0.06)',
              }}
            >
              {formatDate(activePost.date)}
            </span>

            {/* Title — big, bold, pink accent */}
            <h1
              className="font-display leading-[1.05] mb-1"
              style={{
                fontSize: 'clamp(28px, 5vw, 38px)',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: 'var(--gs-light)',
              }}
            >
              {activePost.title}
            </h1>

            {/* Pink highlight bar under title */}
            <motion.div
              className="h-[3px] mt-3 mb-10 rounded-full"
              initial={prefersReduced ? false : { width: '0%' }}
              animate={{ width: '40%' }}
              transition={{ duration: 0.7, delay: 0.25, ease: 'easeOut' }}
              style={{
                background: 'linear-gradient(to right, var(--gs-base), oklch(0.82 0.15 340 / 0.3), transparent)',
                boxShadow: '0 0 12px oklch(0.82 0.15 340 / 0.2)',
              }}
            />
          </motion.div>

          {/* Markdown content */}
          <div className="blog-zine-prose">
            <ReactMarkdown components={zineComponents}>
              {activePost.content}
            </ReactMarkdown>
          </div>

          {/* Bottom spacer */}
          <div className="h-16" />
        </div>
      </div>
    );
  }

  // ─── Post List View ────────────────────────────────────────
  return (
    <div ref={containerRef}>
      {/* Header — editorial masthead */}
      <div className="px-6 pt-6 pb-5">
        <motion.div
          initial={prefersReduced ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1
            className="font-display leading-none"
            style={{
              fontSize: '36px',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: 'var(--gs-base)',
            }}
          >
            UnderTheStack
          </h1>
          <p className="font-data text-[13px] mt-2" style={{ color: 'var(--gs-mid)' }}>
            Marketing technology teardowns.
          </p>
        </motion.div>
      </div>

      {/* Separator — gradient pink line */}
      <div className="h-[2px] mx-6" style={{
        background: 'linear-gradient(to right, var(--gs-base), oklch(0.35 0.05 340 / 0.2), transparent)',
      }} />

      {/* Content */}
      <div className="px-6 py-5">
        {loading ? (
          <div className="space-y-4 pt-2">
            {[65, 80, 55, 75].map((w, i) => (
              <div
                key={i}
                className="skeleton h-[20px] rounded"
                style={{ width: `${w}%`, animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="pt-12 text-center">
            <p className="font-personality text-[18px]" style={{ color: 'var(--gs-mid)' }}>
              Nothing here yet. Chloe is still writing.
            </p>
          </div>
        ) : (
          <motion.div
            variants={listContainer}
            initial="hidden"
            animate="show"
          >
            {posts.map((post) => (
              <motion.button
                key={post.slug}
                variants={listItem}
                onClick={() => openPost(post.slug)}
                disabled={loadingPost}
                className="w-full text-left py-4 group cursor-pointer disabled:opacity-50 block"
                style={{ borderBottom: '1px solid oklch(0.35 0.05 340 / 0.1)' }}
              >
                {/* Date */}
                <time
                  className="font-data text-[12px] uppercase tracking-[0.06em] block mb-1.5"
                  style={{ color: 'var(--gs-mid)' }}
                >
                  {formatDateCompact(post.date)}
                </time>
                {/* Title */}
                <span className="relative block">
                  <span
                    className="font-system text-[15px] leading-snug group-hover:text-gs-base transition-colors duration-200"
                    style={{ color: 'var(--gs-light)' }}
                  >
                    {post.title}
                  </span>
                  <span
                    className="block h-[1.5px] mt-1 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out"
                    style={{ background: 'var(--gs-base)', maxWidth: '60%' }}
                  />
                </span>
                {/* Excerpt peek */}
                <span
                  className="font-data text-[13px] leading-relaxed mt-1.5 block line-clamp-1"
                  style={{ color: 'oklch(0.35 0.05 340 / 0.7)' }}
                >
                  {post.excerpt}
                </span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Zine-styled ReactMarkdown components
// ═══════════════════════════════════════════════════════════════

const zineComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <ScrollReveal>
      <h1 className="font-display text-[28px] mt-16 mb-6" style={{ color: 'var(--gs-light)', fontWeight: 700, letterSpacing: '-0.02em' }}>
        {children}
      </h1>
    </ScrollReveal>
  ),

  h2: ({ children }: { children?: ReactNode }) => (
    <AnimatedH2>{children}</AnimatedH2>
  ),

  h3: ({ children }: { children?: ReactNode }) => (
    <ScrollReveal>
      <h3 className="font-system text-[17px] font-bold mt-10 mb-3" style={{ color: 'var(--gs-bright)' }}>
        {children}
      </h3>
    </ScrollReveal>
  ),

  p: ({ children }: { children?: ReactNode }) => (
    <ScrollReveal>
      <p className="font-data text-[15px] leading-[1.85] mb-5" style={{ color: 'oklch(0.55 0.04 340)' }}>
        {children}
      </p>
    </ScrollReveal>
  ),

  strong: ({ children }: { children?: ReactNode }) => (
    <strong style={{ color: 'var(--gs-light)', fontWeight: 700 }}>{children}</strong>
  ),

  em: ({ children }: { children?: ReactNode }) => (
    <em className="italic">{children}</em>
  ),

  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-baseline gap-0.5 no-underline transition-all duration-200"
      style={{
        color: 'var(--gs-base)',
        textDecorationLine: 'none',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.textDecorationLine = 'underline';
        (e.currentTarget as HTMLElement).style.textDecorationThickness = '1px';
        (e.currentTarget as HTMLElement).style.textUnderlineOffset = '3px';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.textDecorationLine = 'none';
      }}
    >
      {children}
      <span className="text-[11px] opacity-60" aria-hidden="true">↗</span>
    </a>
  ),

  ul: ({ children }: { children?: ReactNode }) => (
    <ScrollReveal>
      <ul className="pl-5 space-y-2.5 mb-6 list-none">
        {children}
      </ul>
    </ScrollReveal>
  ),

  ol: ({ children }: { children?: ReactNode }) => (
    <ScrollReveal>
      <ol className="pl-5 space-y-2.5 mb-6" style={{ counterReset: 'zine-ol' }}>
        {children}
      </ol>
    </ScrollReveal>
  ),

  li: ({ children, ordered }: { children?: ReactNode; ordered?: boolean }) => {
    if (ordered) {
      return (
        <li
          className="font-data text-[15px] leading-[1.8] flex gap-2.5"
          style={{ color: 'oklch(0.55 0.04 340)', counterIncrement: 'zine-ol', listStyle: 'none' }}
        >
          {children}
        </li>
      );
    }
    return (
      <li className="font-data text-[15px] leading-[1.8] flex gap-2.5" style={{ color: 'oklch(0.55 0.04 340)' }}>
        <span className="flex-shrink-0 mt-[3px] text-[10px]" style={{ color: 'var(--gs-base)' }}>▪</span>
        <span>{children}</span>
      </li>
    );
  },

  blockquote: ({ children }: { children?: ReactNode }) => (
    <ScrollReveal>
      <blockquote
        className="relative px-6 py-5 my-8 rounded-r-lg italic"
        style={{
          background: 'oklch(0.18 0.02 340 / 0.5)',
          borderLeft: '3px solid var(--gs-base)',
          color: 'var(--gs-bright)',
        }}
      >
        <span
          className="absolute top-1 left-2 font-personality text-[48px] pointer-events-none select-none leading-none"
          style={{ color: 'oklch(0.82 0.15 340 / 0.12)' }}
          aria-hidden="true"
        >
          &ldquo;
        </span>
        <div className="relative z-[1] font-data text-[15px] leading-[1.8]">{children}</div>
      </blockquote>
    </ScrollReveal>
  ),

  code: ({ children, className }: { children?: ReactNode; className?: string }) => {
    const isBlock = className?.startsWith('language-');
    if (isBlock) {
      return (
        <code className="font-mono text-[13px] block" style={{ color: 'var(--gs-bright)' }}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="font-mono text-[13px] px-1.5 py-0.5 rounded"
        style={{
          background: 'var(--gs-deep)',
          color: 'var(--gs-base)',
          border: '1px solid oklch(0.35 0.05 340 / 0.2)',
        }}
      >
        {children}
      </code>
    );
  },

  pre: ({ children }: { children?: ReactNode }) => (
    <ScrollReveal>
      <pre
        className="rounded-lg p-4 my-6 overflow-x-auto font-mono text-[13px]"
        style={{
          background: 'var(--gs-void)',
          border: '1px solid oklch(0.35 0.05 340 / 0.2)',
        }}
      >
        {children}
      </pre>
    </ScrollReveal>
  ),

  table: ({ children }: { children?: ReactNode }) => (
    <ScrollReveal>
      <div className="overflow-x-auto my-6">
        <table className="w-full text-[13px]">{children}</table>
      </div>
    </ScrollReveal>
  ),

  thead: ({ children }: { children?: ReactNode }) => (
    <thead style={{ background: 'oklch(0.18 0.02 340 / 0.5)' }}>
      {children}
    </thead>
  ),

  th: ({ children }: { children?: ReactNode }) => (
    <th
      className="text-left px-3 py-2.5 font-bold font-data text-[13px]"
      style={{ color: 'var(--gs-light)' }}
    >
      {children}
    </th>
  ),

  tbody: ({ children }: { children?: ReactNode }) => (
    <tbody>{children}</tbody>
  ),

  tr: ({ children }: { children?: ReactNode }) => (
    <tr style={{ borderBottom: '1px solid oklch(0.35 0.05 340 / 0.1)' }}>
      {children}
    </tr>
  ),

  td: ({ children }: { children?: ReactNode }) => (
    <td className="px-3 py-2.5 font-data text-[13px]" style={{ color: 'oklch(0.55 0.04 340)' }}>
      {children}
    </td>
  ),

  hr: () => (
    <div className="flex justify-center my-12">
      <div
        className="h-[2px] w-1/4 rounded-full"
        style={{ background: 'linear-gradient(to right, transparent, var(--gs-base), transparent)' }}
      />
    </div>
  ),

  img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <ScrollReveal>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        {...props}
        alt={props.alt || ''}
        className="rounded-lg my-6 w-full"
        style={{ border: '1px solid oklch(0.35 0.05 340 / 0.2)' }}
      />
    </ScrollReveal>
  ),
};
