import type { Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';

/**
 * Build a Signal object with proper structure.
 */
export function createSignal(params: {
  type: string;
  name: string;
  confidence: number;
  evidence: string;
  category: string;
}): Signal {
  return {
    type: params.type,
    name: params.name,
    confidence: Math.max(0, Math.min(1, params.confidence)),
    evidence: params.evidence,
    category: params.category,
  };
}

/**
 * Build a high-confidence signal (0.9+).
 */
export function createHighConfidenceSignal(
  type: string,
  name: string,
  evidence: string,
  category: string,
): Signal {
  return createSignal({ type, name, confidence: 0.95, evidence, category });
}

/**
 * Build a medium-confidence signal (0.6-0.8).
 */
export function createMediumConfidenceSignal(
  type: string,
  name: string,
  evidence: string,
  category: string,
): Signal {
  return createSignal({ type, name, confidence: 0.7, evidence, category });
}

/**
 * Build a low-confidence signal (0.3-0.5).
 */
export function createLowConfidenceSignal(
  type: string,
  name: string,
  evidence: string,
  category: string,
): Signal {
  return createSignal({ type, name, confidence: 0.4, evidence, category });
}

/**
 * Build a Checkpoint object with proper structure.
 */
export function createCheckpoint(params: {
  id: string;
  name: string;
  weight: number;
  health: CheckpointHealth;
  evidence: string;
  recommendation?: string;
}): Checkpoint {
  return {
    id: params.id,
    name: params.name,
    weight: Math.max(0, Math.min(1, params.weight)),
    health: params.health,
    evidence: params.evidence,
    recommendation: params.recommendation,
  };
}

/**
 * Determine checkpoint health based on a boolean condition.
 */
export function booleanHealth(
  condition: boolean,
  goodHealth: CheckpointHealth = 'good',
  badHealth: CheckpointHealth = 'critical',
): CheckpointHealth {
  return condition ? goodHealth : badHealth;
}

/**
 * Determine checkpoint health based on a numeric score threshold.
 */
export function thresholdHealth(
  value: number,
  thresholds: { excellent: number; good: number; warning: number },
): CheckpointHealth {
  if (value >= thresholds.excellent) return 'excellent';
  if (value >= thresholds.good) return 'good';
  if (value >= thresholds.warning) return 'warning';
  return 'critical';
}

/**
 * Create a standard "detected/not detected" checkpoint pattern.
 */
export function detectionCheckpoint(
  id: string,
  name: string,
  detected: boolean,
  evidence: string,
  weight: number = 0.5,
  recommendation?: string,
): Checkpoint {
  return createCheckpoint({
    id,
    name,
    weight,
    health: detected ? 'good' : 'warning',
    evidence: detected ? evidence : `${name} not detected`,
    recommendation: detected ? undefined : recommendation,
  });
}

/**
 * Create an informational checkpoint (excluded from scoring).
 * Accepts either positional args or an object with id, name, evidence.
 */
export function infoCheckpoint(
  idOrParams: string | { id: string; name: string; weight?: number; evidence: string },
  name?: string,
  evidence?: string,
): Checkpoint {
  if (typeof idOrParams === 'object') {
    return createCheckpoint({
      id: idOrParams.id,
      name: idOrParams.name,
      weight: 0,
      health: 'info',
      evidence: idOrParams.evidence,
    });
  }
  return createCheckpoint({
    id: idOrParams,
    name: name!,
    weight: 0,
    health: 'info',
    evidence: evidence!,
  });
}

/**
 * Aggregate signals by type, keeping only the highest confidence for each.
 */
export function deduplicateSignals(signals: Signal[]): Signal[] {
  const byKey = new Map<string, Signal>();

  for (const signal of signals) {
    const key = `${signal.type}:${signal.name}`;
    const existing = byKey.get(key);
    if (!existing || signal.confidence > existing.confidence) {
      byKey.set(key, signal);
    }
  }

  return Array.from(byKey.values());
}

/**
 * Filter signals by minimum confidence threshold.
 */
export function filterByConfidence(signals: Signal[], minConfidence: number): Signal[] {
  return signals.filter((s) => s.confidence >= minConfidence);
}
