'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShellAlt,
  getM41Summary,
  getModuleResult,
  StatBlock,
  StarRating,
  Pill,
  SkippedSlide,
} from './module-slide-template';

/**
 * M36 Slide — Google Shopping
 * ════════════════════════════
 *
 * Layout B: SlideShellAlt (left viz + right findings).
 * Left panel: Products count StatBlock, category pills, top products list
 * with title, price, and StarRating.
 */

interface TopProduct {
  title?: string;
  price?: number;
  currency?: string;
  seller?: string;
  rating?: number | null;
  ratingCount?: number;
  url?: string;
  tags?: string[];
  delivery?: string | null;
  reviews?: number;
}

function fmtPrice(price: number, currency?: string): string {
  const sym = currency === 'EUR' ? '\u20AC' : currency === 'GBP' ? '\u00A3' : '$';
  return `${sym}${price.toFixed(2)}`;
}

export function M36Slide({ scan }: { scan: ScanWithResults }) {
  const syn = getM41Summary(scan, 'M36');
  const mod = getModuleResult(scan, 'M36');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Google Shopping" scan={scan} sourceLabel="Source: Google Shopping feed, product ratings, merchant data" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Google Shopping presence analysis';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // Raw data
  const totalProducts = typeof raw?.['totalProducts'] === 'number' ? raw['totalProducts'] as number : 0;
  const topProductsRaw = (raw?.['topProducts'] as TopProduct[] | undefined) ?? [];
  const categoriesRaw = (raw?.['categories'] as (string | undefined)[] | undefined) ?? [];
  const merchantName = typeof raw?.['merchantName'] === 'string' ? raw['merchantName'] as string : null;

  const categories = categoriesRaw.filter((c): c is string => typeof c === 'string' && c.length > 0);

  // Normalize products
  const products = topProductsRaw.slice(0, 6).map((p) => ({
    title: typeof p.title === 'string' ? p.title : 'Untitled',
    price: typeof p.price === 'number' ? p.price : 0,
    currency: typeof p.currency === 'string' ? p.currency : 'USD',
    rating: typeof p.rating === 'number' ? p.rating : null,
    ratingCount: typeof p.ratingCount === 'number' ? p.ratingCount : typeof p.reviews === 'number' ? p.reviews : 0,
    seller: typeof p.seller === 'string' ? p.seller : '',
  }));

  // Compute average rating
  const rated = products.filter(p => p.rating != null && p.rating > 0);
  const avgRating = rated.length > 0
    ? rated.reduce((sum, p) => sum + (p.rating ?? 0), 0) / rated.length
    : null;

  const vizContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6em', height: '100%' }}>
      {/* Hero stat tiles — 50/50 */}
      <div style={{ display: 'flex', gap: '0.6em', alignItems: 'stretch' }}>
        <div style={{
          flex: 1, padding: '0.8em 1em', borderRadius: '4px', textAlign: 'center',
          background: 'rgba(255,178,239,0.04)', border: '1px solid rgba(255,178,239,0.08)',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          <p className="font-data tabular-nums" style={{
            fontSize: 'clamp(1px, 2.62cqi, 42px)', fontWeight: 700, lineHeight: 1, color: 'var(--gs-light)',
          }}>
            {totalProducts.toLocaleString()}
          </p>
          <p className="font-data uppercase" style={{
            fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-base)',
            letterSpacing: '0.1em', marginTop: '0.3em',
          }}>
            Products Listed
          </p>
          {merchantName && (
            <p className="font-data" style={{
              fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-mid)', marginTop: '0.2em',
            }}>
              {merchantName}
            </p>
          )}
        </div>
        {avgRating != null && (
          <div style={{
            flex: 1, padding: '0.8em 1em', borderRadius: '4px', textAlign: 'center',
            background: 'rgba(255,178,239,0.04)', border: '1px solid rgba(255,178,239,0.08)',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
          }}>
            <p className="font-data tabular-nums" style={{
              fontSize: 'clamp(1px, 2.62cqi, 42px)', fontWeight: 700, lineHeight: 1,
              color: avgRating >= 4 ? 'var(--gs-terminal)' : avgRating >= 3 ? 'var(--gs-warning)' : 'var(--gs-critical)',
            }}>
              {avgRating.toFixed(1)}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.3em' }}>
              <StarRating rating={avgRating} />
            </div>
            <p className="font-data uppercase" style={{
              fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-base)',
              letterSpacing: '0.1em', marginTop: '0.2em',
            }}>
              Avg Rating
            </p>
          </div>
        )}
      </div>

      {/* Top products list */}
      {products.length > 0 && (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-base)', letterSpacing: '0.1em', marginBottom: '0.3em' }}>
            Top Products
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35em' }}>
            {products.map((p, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '0.6em',
                padding: '0.25em 0',
                borderBottom: i < products.length - 1 ? '1px solid rgba(255,178,239,0.04)' : 'none',
              }}>
                <span className="font-data tabular-nums" style={{
                  fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-mid)',
                  width: '1.2em', textAlign: 'center', flexShrink: 0,
                }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <p className="font-data" style={{
                    fontSize: 'clamp(1px, 0.90cqi, 14px)', color: 'var(--gs-light)', lineHeight: 1.3,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {p.title}
                  </p>
                  {p.seller && (
                    <p className="font-data" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-mid)', lineHeight: 1.2 }}>
                      {p.seller}
                    </p>
                  )}
                </div>
                {p.price > 0 && (
                  <span className="font-data tabular-nums" style={{
                    fontSize: 'clamp(1px, 0.90cqi, 14px)', fontWeight: 600, color: 'var(--gs-light)',
                    flexShrink: 0,
                  }}>
                    {fmtPrice(p.price, p.currency)}
                  </span>
                )}
                {p.rating != null && p.rating > 0 && (
                  <div style={{ flexShrink: 0 }}>
                    <StarRating rating={p.rating} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Categories — bottom */}
      {categories.length > 0 && (
        <div>
          <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-base)', letterSpacing: '0.1em', marginBottom: '0.3em' }}>
            Product Categories
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3em' }}>
            {categories.slice(0, 8).map((cat, i) => (
              <Pill key={i} text={cat} color="var(--gs-base)" />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <SlideShellAlt
      moduleName="Google Shopping"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: Google Shopping feed, product ratings, merchant data"
      vizContent={vizContent}
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
    />
  );
}
