import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidUUID } from '@/lib/utils';

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

          // Only fetch full module data when count changes (avoids transferring all rows every poll)
          if (currentCount > lastModuleCount) {
            const { data: modules } = await supabase
              .from('module_results')
              .select('module_id, status, score')
              .eq('scan_id', id)
              .in('status', ['success', 'partial', 'error']);

            const currentModules = modules ?? [];
            const newModules = currentModules.slice(lastModuleCount);
            for (const mod of newModules) {
              send({
                type: 'module',
                scanId: id,
                moduleId: mod.module_id,
                moduleStatus: mod.status,
                moduleScore: mod.score,
                progress: Math.round((currentModules.length / 45) * 100),
              });
            }
            lastModuleCount = currentModules.length;

            // Adaptive: slow down polling when near completion (>80% done)
            if (currentModules.length > 36 && pollInterval === 2000) {
              pollInterval = 5000;
              clearInterval(interval);
              interval = setInterval(poll, pollInterval);
            }
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

      // Timeout after 10 minutes
      setTimeout(() => {
        if (!closed) {
          send({ type: 'error', scanId: id, error: 'Scan timed out' });
          cleanup(interval, controller);
        }
      }, 600_000);
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
