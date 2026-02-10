import { cn } from '@/lib/utils';

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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Object.entries(tools).map(([category, names]) => (
        <div key={category} className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-xs font-heading font-700 text-muted uppercase tracking-wide mb-2">
            {CATEGORY_LABELS[category] ?? category}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {names.map((name) => (
              <span
                key={name}
                className="inline-block px-2 py-0.5 bg-accent/5 text-accent text-xs font-medium rounded"
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
