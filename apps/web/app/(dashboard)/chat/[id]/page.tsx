import { createClient } from '@/lib/supabase/server';
import { ChatInterface } from '@/components/chat/chat-interface';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';
import { Window } from '@/components/os/window';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';

/**
 * GhostScan OS — Chat Page (Ask Chloe)
 * ═══════════════════════════════════════════
 *
 * WHAT: Full-page chat with Chloe for a specific scan.
 * WHY:  The chat window is a standalone "program" on the OS desktop.
 *       Wraps ChatInterface in a Window component (Plan Section 7).
 * HOW:  Server component fetches messages + credits, renders Window
 *       with ChatInterface inside. Handles error states with Chloe.
 */

export const metadata: Metadata = { title: 'Ask Chloe — GhostScan OS' };

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: scanId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: scan } = await supabase
    .from('scans')
    .select('id, tier, domain')
    .eq('id', scanId)
    .single();

  if (!scan) {
    return (
      <div className="text-center py-gs-8">
        <ChloeSprite state="mischief" size={64} className="mx-auto mb-gs-4" />
        <h1 className="font-system text-os-lg font-bold text-gs-ink">
          Scan not found
        </h1>
      </div>
    );
  }

  if (scan.tier !== 'paid') {
    return (
      <div className="text-center py-gs-8">
        <ChloeSprite state="smug" size={64} className="mx-auto mb-gs-4" />
        <h1 className="font-system text-os-lg font-bold text-gs-ink mb-gs-2">
          Alpha Brief Required
        </h1>
        <p className="font-data text-data-sm text-gs-muted mb-gs-4">
          Upgrade to Alpha Brief to unlock AI Chat for {scan.domain}.
        </p>
        <Link href={`/scan/${scanId}`} className="bevel-button-primary text-os-sm">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('id, role, content, created_at')
    .eq('scan_id', scanId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  const { data: credits } = await supabase
    .from('chat_credits')
    .select('remaining')
    .eq('user_id', user.id)
    .single();

  return (
    <div className="max-w-3xl mx-auto">
      <Window
        id="ask-chloe"
        title={`Ask Chloe — ${scan.domain}`}
        variant="ghost"
        isActive
      >
        <div className="h-[calc(100vh-12rem)]">
          <ChatInterface
            scanId={scanId}
            initialMessages={(messages ?? []).map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              createdAt: m.created_at,
            }))}
            initialCredits={credits?.remaining ?? 0}
          />
        </div>
      </Window>
    </div>
  );
}
