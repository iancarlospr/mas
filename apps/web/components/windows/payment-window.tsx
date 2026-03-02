'use client';

import { useState, useCallback } from 'react';
import { useWindowManager, useWindowState } from '@/lib/window-manager';
import { useAuth } from '@/lib/auth-context';

/**
 * GhostScan OS — Payment Dialog Window (Dynamic)
 * ═══════════════════════════════════════════════════
 *
 * Small checkout confirmation dialog that opens when the user
 * clicks "Declassify $9.99". Confirms the purchase, then
 * redirects to Stripe Checkout.
 */

interface PaymentWindowProps {
  windowId: string;
}

const PRODUCT_LABELS: Record<string, { label: string; price: string }> = {
  alpha_brief: { label: 'Full Intelligence Report', price: '$9.99' },
  chat_activation: { label: 'Chat Activation (15 credits)', price: '$1.00' },
  chat_credits: { label: 'Chat Top-Up (100 credits)', price: '$4.99' },
};

export default function PaymentWindow({ windowId }: PaymentWindowProps) {
  const wm = useWindowManager();
  const windowState = useWindowState(windowId);
  const { isAuthenticated } = useAuth();

  const scanId = windowState?.openData?.scanId as string | undefined;
  const domain = windowState?.openData?.domain as string | undefined;
  const product = (windowState?.openData?.product as string) ?? 'alpha_brief';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productInfo = PRODUCT_LABELS[product] ?? PRODUCT_LABELS.alpha_brief!;

  const handleCheckout = useCallback(async () => {
    if (!scanId) return;
    setLoading(true);
    setError(null);

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
      // Redirect to Stripe — returns to /?payment_success={scanId}
      window.location.href = url;
    } catch {
      setError('Network error. Try again.');
      setLoading(false);
    }
  }, [scanId, product]);

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

  return (
    <div className="p-gs-6 flex flex-col items-center text-center space-y-gs-4">
      <div className="font-system text-os-lg font-bold">
        Unlock Report
      </div>

      {domain && (
        <p className="font-data text-data-sm text-gs-muted">
          {domain}
        </p>
      )}

      <div className="bevel-sunken bg-gs-paper p-gs-4 w-full">
        <p className="font-system text-os-base">
          {productInfo.label}
        </p>
        <p className="font-data text-data-lg font-bold mt-gs-2" style={{ color: 'var(--gs-base)' }}>
          {productInfo.price}
        </p>
        <p className="font-data text-data-xs text-gs-muted mt-gs-1">
          One-time payment. No subscription.
        </p>
      </div>

      {error && (
        <p className="font-data text-data-sm text-gs-critical">{error}</p>
      )}

      <div className="flex gap-gs-2 w-full">
        <button
          onClick={() => wm.closeWindow(windowId)}
          className="bevel-button text-os-sm flex-1"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          onClick={handleCheckout}
          disabled={loading}
          className="bevel-button-primary text-os-sm flex-1"
        >
          {loading ? 'Processing...' : 'Proceed to Checkout'}
        </button>
      </div>
    </div>
  );
}
