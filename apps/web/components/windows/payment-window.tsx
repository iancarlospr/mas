'use client';

import { useState, useCallback } from 'react';
import { useWindowManager, useWindowState } from '@/lib/window-manager';
import { useAuth } from '@/lib/auth-context';

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

const UPGRADE_PRODUCTS = [
  {
    id: 'alpha_brief',
    label: 'Alpha Brief',
    price: '$24.99',
    features: ['1 scan', '25 chat credits', 'PRD + PDF'],
  },
  {
    id: 'alpha_brief_plus',
    label: 'Alpha Brief Plus',
    price: '$34.95',
    features: ['3 scans', '200 chat credits', 'AI agents'],
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

  const handleCheckout = useCallback(async () => {
    if (!scanId) return;
    setLoading(true);
    setError(null);

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

  // Upgrade purchase — show both tiers
  return (
    <div className="px-gs-6 pt-gs-3 pb-gs-6 space-y-gs-4">
      <div className="text-center">
        <div className="font-system text-os-lg font-bold">Unlock Report</div>
        {domain && (
          <p className="font-data text-data-xs text-gs-muted mt-gs-1">{domain}</p>
        )}
      </div>

      <div className="space-y-gs-2">
        {UPGRADE_PRODUCTS.map((prod) => (
          <button
            key={prod.id}
            onClick={() => setSelectedProduct(prod.id)}
            className={`w-full text-left p-gs-3 rounded-lg border transition-all cursor-pointer ${
              selectedProduct === prod.id
                ? 'border-gs-red bg-gs-red/5'
                : 'border-gs-mid/20 hover:border-gs-mid/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-system text-os-sm font-bold">{prod.label}</span>
              <span className="font-data text-data-sm font-bold" style={{ color: 'var(--gs-base)' }}>
                {prod.price}
              </span>
            </div>
            <div className="flex gap-gs-2 mt-gs-1">
              {prod.features.map((f) => (
                <span key={f} className="font-data text-[10px] text-gs-muted">
                  {f}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      {error && <p className="font-data text-data-sm text-gs-critical">{error}</p>}

      <div className="flex gap-gs-2 w-full">
        <button onClick={() => wm.closeWindow(windowId)} className="bevel-button text-os-sm flex-1" disabled={loading}>
          Cancel
        </button>
        <button onClick={handleCheckout} disabled={loading} className="bevel-button-primary text-os-sm flex-1">
          {loading ? 'Processing...' : 'Proceed to Checkout'}
        </button>
      </div>
    </div>
  );
}
