'use client';

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="bevel-button text-os-sm"
    >
      Download PDF
    </button>
  );
}
