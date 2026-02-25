interface TechStackProps {
  tools: Record<string, string[]>;
}

const CATEGORY_LABELS: Record<string, string> = {
  analytics: 'Analytics',
  advertising: 'Advertising',
  automation: 'Marketing Automation',
  cms: 'CMS',
  framework: 'Framework',
  cdn: 'CDN',
  hosting: 'Hosting',
  chat: 'Chat & Support',
  ab_testing: 'A/B Testing',
  monitoring: 'Error Monitoring',
  payment: 'Payments',
  security: 'Security',
  server: 'Server',
  language: 'Language',
  other: 'Other',
};

export function TechStack({ tools }: TechStackProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-gs-4">
      {Object.entries(tools).map(([category, names]) => (
        <div key={category} className="bevel-raised bg-gs-light p-gs-4">
          <h3 className="font-system text-os-xs text-gs-mid-dark uppercase tracking-wider mb-gs-2">
            {CATEGORY_LABELS[category] ?? category}
          </h3>
          <div className="flex flex-wrap gap-gs-1">
            {names.map((name) => (
              <span
                key={name}
                className="bevel-sunken bg-gs-near-white px-gs-2 py-gs-1 font-data text-data-xs text-gs-cyan"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
