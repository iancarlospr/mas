'use client';

import { useState, useCallback } from 'react';
import { useWindowManager, useWindowState } from '@/lib/window-manager';
import { useAuth } from '@/lib/auth-context';
import { analytics } from '@/lib/analytics';

/**
 * GhostScan OS — Payment Dialog Window (Dynamic)
 * ═══════════════════════════════════════════════════
 *
 * Checkout confirmation dialog. Shows two upgrade tiers
 * (Alpha Brief / Alpha Brief Plus) for scan upgrades,
 * or a single product for chat credit purchases.
 */

interface PaymentWindowProps {
  windowId: string;
}

interface Feature { text: string; included: boolean }

const UPGRADE_PRODUCTS = [
  {
    id: 'alpha_brief',
    label: 'Alpha Brief',
    price: '$24.99',
    originalPrice: '$49.99',
    desc: '1 full forensic scan.',
    features: [
      { text: '1 full forensic scan', included: true },
      { text: 'All 45 modules', included: true },
      { text: 'Executive Brief + PRD + Boss Deck', included: true },
      { text: 'PDF export + .MD for NotebookLM', included: true },
      { text: '25 GhostChat™ credits', included: true },
      { text: 'AI agents', included: false },
      { text: 'Priority queue', included: false },
    ] as Feature[],
    highlighted: false,
  },
  {
    id: 'alpha_brief_plus',
    label: 'Alpha Brief Plus',
    badge: 'Best Value',
    price: '$34.95',
    perUnit: '$11.65/scan',
    desc: '3 scans. Your site + 2 competitors.',
    features: [
      { text: '3 full forensic scans', included: true },
      { text: 'All 45 modules per scan', included: true },
      { text: 'Executive Brief + PRD + Boss Deck', included: true },
      { text: 'PDF export + .MD for NotebookLM', included: true },
      { text: '200 GhostChat™ credits', included: true },
      { text: 'Deploy AI agents', included: true },
      { text: 'Priority scan queue', included: true },
    ] as Feature[],
    highlighted: true,
  },
];

const CHAT_PRODUCTS: Record<string, { label: string; price: string }> = {
  chat_credits_15: { label: 'Chat Credits (15)', price: '$1.00' },
  chat_credits: { label: 'Chat Credits (100)', price: '$4.99' },
};

export default function PaymentWindow({ windowId }: PaymentWindowProps) {
  const wm = useWindowManager();
  const windowState = useWindowState(windowId);
  const { isAuthenticated } = useAuth();

  const scanId = windowState?.openData?.scanId as string | undefined;
  const domain = windowState?.openData?.domain as string | undefined;
  const initialProduct = (windowState?.openData?.product as string) ?? 'alpha_brief';

  const isChatProduct = initialProduct in CHAT_PRODUCTS;

  const [selectedProduct, setSelectedProduct] = useState(initialProduct);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckoutDirect = useCallback(async (product: string) => {
    if (!scanId) return;
    setLoading(true);
    setSelectedProduct(product);
    setError(null);

    const amountMap: Record<string, number> = {
      alpha_brief: 2499, alpha_brief_plus: 3495,
      chat_credits_15: 100, chat_credits: 499,
    };
    analytics.checkoutStarted(product, scanId, amountMap[product] ?? 0);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product, scanId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Checkout failed.');
        setLoading(false);
        return;
      }

      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setError('Network error. Try again.');
      setLoading(false);
    }
  }, [scanId]);

  const handleCheckout = useCallback(async () => {
    if (!scanId) return;
    setLoading(true);
    setError(null);

    const amountMap: Record<string, number> = {
      alpha_brief: 2499, alpha_brief_plus: 3495,
      chat_credits_15: 100, chat_credits: 499,
    };
    analytics.checkoutStarted(selectedProduct, scanId, amountMap[selectedProduct] ?? 0);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: selectedProduct, scanId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Checkout failed.');
        setLoading(false);
        return;
      }

      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setError('Network error. Try again.');
      setLoading(false);
    }
  }, [scanId, selectedProduct]);

  if (!isAuthenticated) {
    return (
      <div className="p-gs-6 text-center space-y-gs-4">
        <p className="font-system text-os-base font-bold">Login Required</p>
        <p className="font-data text-data-sm text-gs-muted">
          You need to be logged in to purchase.
        </p>
        <button
          onClick={() => wm.openWindow('auth')}
          className="bevel-button-primary"
        >
          Log In
        </button>
      </div>
    );
  }

  // Chat credit purchase — single product, no selection needed
  if (isChatProduct) {
    const chatInfo = CHAT_PRODUCTS[initialProduct]!;
    return (
      <div className="p-gs-6 flex flex-col items-center text-center space-y-gs-4">
        <div className="font-system text-os-lg font-bold">{chatInfo.label}</div>
        <div className="bevel-sunken bg-gs-paper p-gs-4 w-full">
          <p className="font-data text-data-lg font-bold" style={{ color: 'var(--gs-base)' }}>
            {chatInfo.price}
          </p>
          <p className="font-data text-data-xs text-gs-muted mt-gs-1">One-time purchase.</p>
        </div>
        {error && <p className="font-data text-data-sm text-gs-critical">{error}</p>}
        <div className="flex gap-gs-2 w-full">
          <button onClick={() => wm.closeWindow(windowId)} className="bevel-button text-os-sm flex-1" disabled={loading}>Cancel</button>
          <button onClick={handleCheckout} disabled={loading} className="bevel-button-primary text-os-sm flex-1">
            {loading ? 'Processing...' : 'Proceed to Checkout'}
          </button>
        </div>
      </div>
    );
  }

  // Upgrade purchase — pricing cards
  return (
    <div className="px-gs-4 pt-gs-3 pb-gs-4 space-y-gs-3">
      <style>{`
        @keyframes checkout-glow {
          0%, 100% { box-shadow: 0 0 12px oklch(0.75 0.2 340 / 0.15), inset 0 1px 0 oklch(0.75 0.2 340 / 0.1); }
          50% { box-shadow: 0 0 24px oklch(0.75 0.2 340 / 0.25), inset 0 1px 0 oklch(0.75 0.2 340 / 0.15); }
        }
        .checkout-highlight { animation: checkout-glow 3s ease-in-out infinite; }
      `}</style>

      <div className="text-center">
        <div className="font-system text-os-lg font-bold">Unlock Report</div>
        {domain && (
          <p className="font-data text-data-xs text-gs-muted mt-gs-1">{domain}</p>
        )}
      </div>

      {/* Plus tier — hero card */}
      {(() => {
        const plus = UPGRADE_PRODUCTS.find((p) => p.highlighted)!;
        return (
          <div className="relative bevel-raised bg-gs-red/5 border-2 border-gs-red p-gs-4 checkout-highlight">
            <div className="absolute -top-[10px] left-1/2 -translate-x-1/2 bg-gs-red text-gs-void font-system text-[8px] font-bold uppercase tracking-wider px-gs-2 py-[2px] rounded-sm whitespace-nowrap">
              {plus.badge}
            </div>

            <div className="flex items-start justify-between pt-gs-1">
              <div>
                <h3 className="font-system text-os-sm font-bold">{plus.label}</h3>
                <p className="font-data text-[10px] text-gs-muted mt-[2px]">{plus.desc}</p>
              </div>
              <div className="text-right flex-shrink-0 ml-gs-3">
                <span className="font-data font-bold text-[22px]">{plus.price}</span>
                {plus.perUnit && (
                  <div className="font-data text-[9px] text-gs-red font-bold">{plus.perUnit}</div>
                )}
              </div>
            </div>

            <ul className="space-y-[4px] mt-gs-3">
              {plus.features.map((f, i) => (
                <li key={f.text} className={`flex items-center gap-[6px] text-[11px] ${i === 0 ? 'py-[3px] px-[6px] rounded-sm' : ''}`} style={i === 0 ? { background: 'oklch(0.75 0.2 340 / 0.1)' } : undefined}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={i === 0 ? 'var(--gs-base)' : 'var(--gs-terminal)'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><path d="M20 6 9 17l-5-5" /></svg>
                  <span className={i === 0 ? 'text-gs-base font-bold' : 'text-gs-light/85'}>{f.text}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckoutDirect(plus.id)}
              disabled={loading}
              className="bevel-button-primary w-full py-gs-1 font-system text-os-xs font-bold mt-gs-3"
            >
              {loading && selectedProduct === plus.id ? 'Processing...' : 'Unlock Everything'}
            </button>
          </div>
        );
      })()}

      {/* Divider */}
      <div className="flex items-center gap-gs-2">
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, oklch(0.35 0.05 340 / 0.3), transparent)' }} />
        <span className="font-data text-[9px] text-gs-mid uppercase tracking-widest">or</span>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, oklch(0.35 0.05 340 / 0.3), transparent)' }} />
      </div>

      {/* Single tier — compact */}
      {(() => {
        const single = UPGRADE_PRODUCTS.find((p) => !p.highlighted)!;
        return (
          <div className="bevel-raised bg-gs-chrome p-gs-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-system text-os-xs font-bold">{single.label}</h3>
                <p className="font-data text-[10px] text-gs-muted">{single.desc}</p>
              </div>
              <div className="flex items-baseline gap-gs-1 flex-shrink-0 ml-gs-3">
                {single.originalPrice && (
                  <span className="font-data text-[10px] text-gs-mid line-through">{single.originalPrice}</span>
                )}
                <span className="font-data font-bold text-data-lg">{single.price}</span>
              </div>
            </div>

            <ul className="space-y-[3px] mt-gs-2">
              {single.features.filter((f) => f.included).map((f, i) => (
                <li key={f.text} className={`flex items-center gap-[6px] text-[11px] ${i === 0 ? 'py-[2px] px-[6px] rounded-sm' : ''}`} style={i === 0 ? { background: 'oklch(0.35 0.05 340 / 0.15)' } : undefined}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={i === 0 ? 'var(--gs-light)' : 'var(--gs-terminal)'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><path d="M20 6 9 17l-5-5" /></svg>
                  <span className={i === 0 ? 'text-gs-light font-bold' : 'text-gs-light/70'}>{f.text}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckoutDirect(single.id)}
              disabled={loading}
              className="bevel-button w-full py-gs-1 font-system text-os-xs font-bold mt-gs-2"
            >
              {loading && selectedProduct === single.id ? 'Processing...' : 'Get Full Report'}
            </button>
          </div>
        );
      })()}

      {error && <p className="font-data text-data-xs text-gs-critical text-center">{error}</p>}
    </div>
  );
}
