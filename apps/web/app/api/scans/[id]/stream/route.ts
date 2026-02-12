import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const encoder = new TextEncoder();
  let lastStatus = '';
  let lastModuleCount = 0;
  let closed = false;
  let consecutiveErrors = 0;

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

      // Poll every 2 seconds
      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }

        try {
          const { data: scan } = await supabase
            .from('scans')
            .select('status, marketing_iq')
            .eq('id', id)
            .single();

          if (!scan) {
            send({ type: 'error', scanId: id, error: 'Scan not found' });
            clearInterval(interval);
            closed = true;
            controller.close();
            return;
          }

          const { data: modules } = await supabase
            .from('module_results')
            .select('module_id, status, score')
            .eq('scan_id', id)
            .in('status', ['success', 'partial', 'error']);

          const currentModules = modules ?? [];

          // Send status update if changed
          if (scan.status !== lastStatus) {
            lastStatus = scan.status;
            send({
              type: 'status',
              scanId: id,
              status: scan.status,
            });
          }

          // Send new module completions
          if (currentModules.length > lastModuleCount) {
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
            clearInterval(interval);
            closed = true;
            controller.close();
          } else if (scan.status === 'failed' || scan.status === 'cancelled') {
            send({
              type: 'error',
              scanId: id,
              error: `Scan ${scan.status}`,
            });
            clearInterval(interval);
            closed = true;
            controller.close();
          }
        } catch (err) {
          console.error(`[stream/${id}] Poll error:`, err);
          consecutiveErrors++;
          if (consecutiveErrors >= 3) {
            send({ type: 'error', scanId: id, error: 'Connection lost. Please refresh.' });
            clearInterval(interval);
            closed = true;
            controller.close();
          }
        }
      }, 2000);

      // Timeout after 10 minutes
      setTimeout(() => {
        if (!closed) {
          clearInterval(interval);
          send({ type: 'error', scanId: id, error: 'Scan timed out' });
          closed = true;
          controller.close();
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
