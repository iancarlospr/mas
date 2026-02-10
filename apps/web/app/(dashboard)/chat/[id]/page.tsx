import { createClient } from '@/lib/supabase/server';
import { ChatInterface } from '@/components/chat/chat-interface';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'AI Chat' };

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: scanId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Check scan exists and is paid tier
  const { data: scan } = await supabase
    .from('scans')
    .select('id, tier, domain')
    .eq('id', scanId)
    .single();

  if (!scan) {
    return (
      <div className="text-center py-12">
        <h1 className="font-heading text-h3 text-primary">Scan not found</h1>
      </div>
    );
  }

  if (scan.tier !== 'paid') {
    return (
      <div className="text-center py-12">
        <h1 className="font-heading text-h3 text-primary mb-2">
          Alpha Brief Required
        </h1>
        <p className="text-muted text-sm">
          Upgrade to Alpha Brief to unlock the AI Chat for {scan.domain}.
        </p>
      </div>
    );
  }

  // Fetch messages and credits
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
  );
}
