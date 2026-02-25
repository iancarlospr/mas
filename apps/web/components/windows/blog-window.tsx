'use client';

/* ═══════════════════════════════════════════════════════════════
   Blog — Window Content

   Blog post listing. Static content for now.
   ═══════════════════════════════════════════════════════════════ */

export default function BlogWindow() {
  return (
    <div className="p-gs-6 space-y-gs-4">
      <h1 className="font-display text-display-sm">UnderTheStack</h1>
      <p className="font-data text-data-sm text-gs-muted">
        Marketing technology teardowns, insights, and analysis.
      </p>

      <div className="bevel-sunken p-gs-8 text-center space-y-gs-2">
        <div className="text-[32px]">📝</div>
        <p className="font-system text-os-base text-gs-muted">No posts yet.</p>
        <p className="font-data text-data-xs text-gs-muted">Check back soon.</p>
      </div>
    </div>
  );
}
