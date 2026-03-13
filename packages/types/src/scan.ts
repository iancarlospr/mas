import type { ModuleId, ModuleTier, MarketingIQResult, ModuleResult } from './modules.js';

export type ScanStatus =
  | 'queued'
  | 'passive'
  | 'browser'
  | 'ghostscan'
  | 'external'
  | 'paid-media'
  | 'synthesis'
  | 'complete'
  | 'failed'
  | 'cancelled';

export type ScanHealth = 'healthy' | 'partial' | 'degraded' | 'minimal';

export interface Scan {
  id: string;
  userId: string | null;
  url: string;
  domain: string;
  tier: ModuleTier;
  status: ScanStatus;
  marketingIq: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  ipAddress: string | null;
  countryCode: string | null;
  cacheSource: string | null;
}

export interface ScanWithResults extends Scan {
  moduleResults: ModuleResult[];
  marketingIqResult: MarketingIQResult | null;
}

export interface CreateScanRequest {
  url: string;
  turnstileToken: string;
}

export interface CreateScanResponse {
  scanId: string;
  cached: boolean;
}

export interface ScanProgressEvent {
  type: 'status' | 'module' | 'complete' | 'error';
  scanId: string;
  status?: ScanStatus;
  moduleId?: ModuleId;
  moduleStatus?: string;
  moduleScore?: number | null;
  progress?: number;
  marketingIq?: number | null;
  error?: string;
}

export interface UpgradeScanRequest {
  stripeSessionId: string;
}

export function computeScanHealth(moduleResults: ModuleResult[]): ScanHealth {
  const total = moduleResults.length;
  if (total === 0) return 'minimal';
  const successful = moduleResults.filter(r => r.status === 'success' || r.status === 'partial').length;
  const ratio = successful / total;

  if (ratio >= 0.9) return 'healthy';
  if (ratio >= 0.7) return 'partial';
  if (ratio >= 0.4) return 'degraded';
  return 'minimal';
}

export function getTrafficLight(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 70) return 'green';
  if (score >= 40) return 'yellow';
  return 'red';
}

export function getMarketingIQLabel(score: number): string {
  if (score >= 85) return 'Marketing Leader';
  if (score >= 70) return 'Competitive';
  if (score >= 50) return 'Developing';
  if (score >= 30) return 'At Risk';
  return 'Critical';
}
