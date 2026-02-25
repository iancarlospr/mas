'use client';

/* ═══════════════════════════════════════════════════════════════
   Customers — Window Content
   Social proof badges + testimonials.
   ═══════════════════════════════════════════════════════════════ */

const STATS = [
  { value: '10,000+', label: 'URLs Scanned' },
  { value: '45', label: 'Forensic Modules' },
  { value: '< 90s', label: 'Scan Time' },
  { value: '99.7%', label: 'Detection Rate' },
];

export default function CustomersWindow() {
  return (
    <div className="p-gs-6 space-y-gs-6">
      <h1 className="font-display text-display-sm">Social Proof</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-gs-3">
        {STATS.map((s) => (
          <div key={s.label} className="bevel-sunken p-gs-3 text-center">
            <div className="font-data text-data-2xl font-bold text-gs-red">{s.value}</div>
            <div className="font-system text-os-xs text-gs-muted mt-gs-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Testimonial */}
      <div className="bevel-raised bg-gs-chrome p-gs-4 space-y-gs-2">
        <p className="font-data text-data-sm italic">
          &ldquo;We had no idea our tag manager was leaking PII to 14 different vendors.
          AlphaScan found it in 90 seconds.&rdquo;
        </p>
        <p className="font-system text-os-xs text-gs-muted">— Head of Marketing, Series B SaaS</p>
      </div>
    </div>
  );
}
