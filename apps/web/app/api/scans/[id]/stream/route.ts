import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidUUID } from '@/lib/utils';

/**
 * Weight per module — proportional to real execution time.
 * M21 (Ad Library) takes ~5min alone. Synthesis modules take 30s-2min each.
 * Passive/browser modules complete in seconds.
 */
const MODULE_WEIGHTS: Record<string, number> = {
  // Phase 1: Passive (parallel, burst in ~10s)
  M01: 1, M02: 1, M04: 1, M16: 1, M17: 1, M18: 1, M19: 1, M39: 1,
  // Phase 2: Browser (sequential, ~10s each)
  M03: 2, M05: 2, M07: 2, M08: 2, M13: 2, M14: 2, M15: 2, M20: 2,
  // Phase 3: GhostScan (~10s each)
  M09: 2, M10: 2, M11: 2, M12: 2,
  // Phase 4: External — M21 is the monster (~5min), M22/M23 medium (~1min), rest fast
  M21: 50, M22: 8, M23: 8,
  M24: 2, M25: 2, M26: 2, M27: 2, M28: 2, M29: 2, M30: 2, M31: 2,
  M33: 2, M34: 2, M36: 3, M37: 2, M38: 2, M40: 3,
  // Phase 4.5: Paid Media (fresh browser, ~30s total)
  M06: 4, M06b: 2,
  // Phase 5: Synthesis (Gemini API, ~2.5min total)
  M41: 30, M42: 20, M43: 25, M45: 15, M46: 12,
};
const TOTAL_WEIGHT = Object.values(MODULE_WEIGHTS).reduce((a, b) => a + b, 0);
const DEFAULT_WEIGHT = 2;

// Time-based floor: exponential ease-out so bar moves fast early, slows gradually, never stops
const TIME_FLOOR_TAU = 300;  // time constant (~5min) — controls deceleration rate
const TIME_FLOOR_CAP = 95;   // asymptotic cap; never actually reached, only complete event sends 100

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Invalid scan ID' }, { status: 400 });
  }
  const supabase = await createClient();

  // Auth: verify ownership before opening stream
  const { data: { user } } = await supabase.auth.getUser();
  const { data: scanOwner } = await supabase
    .from('scans')
    .select('user_id')
    .eq('id', id)
    .single();

  if (!scanOwner) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }
  // Allow if user owns the scan OR scan has no owner (anonymous/cached)
  if (scanOwner.user_id && (!user || scanOwner.user_id !== user.id)) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  const signal = request.signal;
  const encoder = new TextEncoder();
  let lastStatus = '';
  let lastModuleCount = 0;
  let closed = false;
  let consecutiveErrors = 0;

  const cleanup = (interval: ReturnType<typeof setInterval>, controller: ReadableStreamDefaultController) => {
    clearInterval(interval);
    if (!closed) {
      closed = true;
      try { controller.close(); } catch { /* already closed */ }
    }
  };

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // Adaptive polling: 2s during active scan, 5s near completion
      let pollInterval = 2000;

      // Smooth progress state
      let scanStartTime: number | null = null;
      let lastSentProgress = 0;
      let completedModuleIds: string[] = [];

      const poll = async () => {
        if (closed || signal.aborted) {
          cleanup(interval, controller);
          return;
        }

        try {
          // Single combined query: scan status + module count check
          const { data: scan } = await supabase
            .from('scans')
            .select('status, marketing_iq')
            .eq('id', id)
            .single();

          if (!scan) {
            send({ type: 'error', scanId: id, error: 'Scan not found' });
            cleanup(interval, controller);
            return;
          }

          // Only fetch full module results when we detect new completions
          const { count } = await supabase
            .from('module_results')
            .select('*', { count: 'exact', head: true })
            .eq('scan_id', id)
            .in('status', ['success', 'partial', 'error']);

          const currentCount = count ?? 0;

          // Send status update if changed
          if (scan.status !== lastStatus) {
            lastStatus = scan.status;
            send({ type: 'status', scanId: id, status: scan.status });
          }

          // Start clock from first module completion
          if (scanStartTime === null && currentCount > 0) {
            scanStartTime = Date.now();
          }

          // --- Module-based weighted progress ---
          let weightedSum = 0;
          if (currentCount > lastModuleCount) {
            // Fetch module IDs (only when count changes)
            const { data: modules } = await supabase
              .from('module_results')
              .select('module_id, status')
              .eq('scan_id', id)
              .in('status', ['success', 'partial', 'error']);

            const currentModules = modules ?? [];
            completedModuleIds = currentModules.map(m => m.module_id);
            weightedSum = completedModuleIds.reduce(
              (sum, mid) => sum + (MODULE_WEIGHTS[mid] ?? DEFAULT_WEIGHT), 0
            );
            const weightedPct = (weightedSum / TOTAL_WEIGHT) * 100;

            // Time-based floor for this tick
            let timeFloor = 0;
            if (scanStartTime !== null) {
              const elapsed = (Date.now() - scanStartTime) / 1000;
              timeFloor = TIME_FLOOR_CAP * (1 - Math.exp(-elapsed / TIME_FLOOR_TAU));
            }

            const progress = Math.min(99, Math.round(Math.max(weightedPct, timeFloor)));

            // Send module events for new completions
            const newModules = currentModules.slice(lastModuleCount);
            for (const mod of newModules) {
              send({
                type: 'module',
                scanId: id,
                moduleId: mod.module_id,
                moduleStatus: mod.status,
                progress,
              });
            }
            lastModuleCount = currentModules.length;
            lastSentProgress = progress;
          } else {
            // No new modules — recalculate weighted sum from cache
            weightedSum = completedModuleIds.reduce(
              (sum, mid) => sum + (MODULE_WEIGHTS[mid] ?? DEFAULT_WEIGHT), 0
            );

            // Time-based floor keeps the bar moving during long modules (M21, synthesis)
            let timeFloor = 0;
            if (scanStartTime !== null) {
              const elapsed = (Date.now() - scanStartTime) / 1000;
              timeFloor = TIME_FLOOR_CAP * (1 - Math.exp(-elapsed / TIME_FLOOR_TAU));
            }

            const weightedPct = (weightedSum / TOTAL_WEIGHT) * 100;
            const smoothProgress = Math.min(99, Math.round(Math.max(weightedPct, timeFloor)));

            // Send progress tick if it advanced (even without new module completions)
            if (smoothProgress > lastSentProgress) {
              send({ type: 'status', scanId: id, progress: smoothProgress });
              lastSentProgress = smoothProgress;
            }
          }

          // Adaptive: slow down polling during synthesis (>80% weighted progress)
          if (weightedSum / TOTAL_WEIGHT > 0.80 && pollInterval === 2000) {
            pollInterval = 5000;
            clearInterval(interval);
            interval = setInterval(poll, pollInterval);
          }

          consecutiveErrors = 0;

          // Check terminal states
          if (scan.status === 'complete') {
            send({
              type: 'complete',
              scanId: id,
              marketingIq: scan.marketing_iq,
              progress: 100,
            });
            cleanup(interval, controller);
          } else if (scan.status === 'failed' || scan.status === 'cancelled') {
            send({ type: 'error', scanId: id, error: `Scan ${scan.status}` });
            cleanup(interval, controller);
          }
        } catch (err) {
          console.error(`[stream/${id}] Poll error:`, err);
          consecutiveErrors++;
          if (consecutiveErrors >= 3) {
            send({ type: 'error', scanId: id, error: 'Connection lost. Please refresh.' });
            cleanup(interval, controller);
          }
        }
      };

      let interval = setInterval(poll, pollInterval);

      // Detect client disconnect
      signal.addEventListener('abort', () => cleanup(interval, controller), { once: true });

      // Timeout after 20 minutes (scans can take up to 18min with retries)
      setTimeout(() => {
        if (!closed) {
          send({ type: 'error', scanId: id, error: 'Scan timed out' });
          cleanup(interval, controller);
        }
      }, 1_200_000);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
