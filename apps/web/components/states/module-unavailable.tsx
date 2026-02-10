interface ModuleUnavailableProps {
  moduleName: string;
  error?: string;
}

export function ModuleUnavailable({ moduleName, error }: ModuleUnavailableProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-6 opacity-60">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-heading text-sm font-700 text-primary">{moduleName}</h3>
        <span className="text-xs text-warning bg-warning/10 px-2 py-0.5 rounded-full font-medium">
          Unavailable
        </span>
      </div>
      <p className="text-xs text-muted">
        This module couldn&apos;t complete its analysis.
        {error && <> Reason: {error}</>}
      </p>
      <p className="text-xs text-muted mt-1">Other modules are not affected.</p>
    </div>
  );
}
