'use client';

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 bg-accent text-white rounded-lg px-4 py-2 text-sm font-heading font-700 hover:bg-accent/90 transition-colors"
    >
      Download PDF
    </button>
  );
}
