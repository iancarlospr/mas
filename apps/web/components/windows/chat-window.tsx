'use client';

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { analytics } from '@/lib/analytics';
import { soundEffects } from '@/lib/sound-effects';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';
import { BevelInput } from '@/components/os/bevel-input';
import { useWindowManager, useWindowState } from '@/lib/window-manager';
import { useAuth } from '@/lib/auth-context';

/* ═══════════════════════════════════════════════════════════════
   GhostChat — In-Window Chat with Chloé

   Dynamic window component (same pattern as ScanReportWindow).
   Self-contained: fetches history via GET /api/chat/[scanId],
   sends messages via POST, renders markdown responses.

   Opens alongside the scan report window so the user can read
   slides and chat simultaneously.
   ═══════════════════════════════════════════════════════════════ */

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface ChatWindowProps {
  windowId: string;
}

// ── Ghost icon SVG (matches chloe-callout.tsx) ──────────────
function GhostIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M8 1C5.2 1 3 3.2 3 6v6l1-1.5 1 1.5 1-1.5 1 1.5 1-1.5 1 1.5 1-1.5 1 1.5V6c0-2.8-2.2-5-5-5z"/>
      <circle cx="6" cy="5.5" r="1" fill="var(--gs-void)"/>
      <circle cx="10" cy="5.5" r="1" fill="var(--gs-void)"/>
    </svg>
  );
}

// ── Compact markdown components for chat bubbles ────────────
const chatMarkdownComponents = {
  p: ({ children }: { children?: ReactNode }) => (
    <p className="font-data text-data-sm leading-relaxed mb-1.5" style={{ color: 'oklch(0.88 0.01 340)' }}>
      {children}
    </p>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong style={{ color: 'var(--gs-light)', fontWeight: 700 }}>{children}</strong>
  ),
  em: ({ children }: { children?: ReactNode }) => (
    <em className="italic">{children}</em>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="pl-4 space-y-0.5 mb-1.5" style={{ listStyleType: 'disc' }}>{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="pl-4 space-y-0.5 mb-1.5" style={{ listStyleType: 'decimal' }}>{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="font-data text-data-sm" style={{ color: 'oklch(0.88 0.01 340)' }}>
      {children}
    </li>
  ),
  code: ({ children, className }: { children?: ReactNode; className?: string }) => {
    const isBlock = className?.startsWith('language-');
    if (isBlock) {
      return (
        <pre className="bevel-sunken p-gs-2 rounded overflow-x-auto mb-1.5" style={{ background: 'var(--gs-deep)' }}>
          <code className="font-mono" style={{ color: 'var(--gs-light)', fontSize: '12px' }}>
            {children}
          </code>
        </pre>
      );
    }
    return (
      <code className="font-mono px-1 py-0.5 rounded" style={{ background: 'var(--gs-deep)', fontSize: '0.9em' }}>
        {children}
      </code>
    );
  },
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80" style={{ color: 'var(--gs-base)' }}>
      {children}
    </a>
  ),
  h1: ({ children }: { children?: ReactNode }) => (
    <h4 className="font-data font-bold mb-1" style={{ color: 'var(--gs-light)', fontSize: '14px' }}>{children}</h4>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h4 className="font-data font-bold mb-1" style={{ color: 'var(--gs-light)', fontSize: '13px' }}>{children}</h4>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h4 className="font-data font-bold mb-1" style={{ color: 'var(--gs-light)', fontSize: '13px' }}>{children}</h4>
  ),
  hr: () => (
    <hr className="my-2 border-0" style={{ height: '1px', background: 'var(--gs-mid)' }} />
  ),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="pl-3 mb-1.5" style={{ borderLeft: '2px solid var(--gs-base)', color: 'var(--gs-mid)' }}>
      {children}
    </blockquote>
  ),
};

export default function ChatWindow({ windowId }: ChatWindowProps) {
  const wm = useWindowManager();
  const windowState = useWindowState(windowId);
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  const scanId = windowState?.openData?.scanId as string | undefined;
  const domain = windowState?.openData?.domain as string | undefined;

  const [messages, setMessages] = useState<Message[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorState, setErrorState] = useState<{
    type: 'auth' | 'activation' | 'not_paid' | 'fetch_error';
    message: string;
  } | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasFetched = useRef(false);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // Fetch chat history on mount
  const fetchHistory = useCallback(async () => {
    if (!scanId) return;
    setLoading(true);
    setErrorState(null);

    try {
      const res = await fetch(`/api/chat/${scanId}`);

      if (res.status === 401) {
        setErrorState({ type: 'auth', message: 'Log in to chat with Chloé.' });
        setLoading(false);
        return;
      }

      if (res.status === 404) {
        setErrorState({ type: 'fetch_error', message: 'Scan not found or access denied.' });
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setErrorState({ type: 'fetch_error', message: 'Failed to load chat.' });
        setLoading(false);
        return;
      }

      const data = await res.json();
      setMessages(data.messages ?? []);
      setCredits(data.creditsRemaining ?? 0);
    } catch {
      setErrorState({ type: 'fetch_error', message: 'Connection failed. Try again.' });
    }

    setLoading(false);
  }, [scanId]);

  useEffect(() => {
    if (scanId && !hasFetched.current && !authLoading) {
      if (!isAuthenticated) {
        setErrorState({ type: 'auth', message: 'Log in to chat with Chloé.' });
        setLoading(false);
        return;
      }
      hasFetched.current = true;
      fetchHistory();
    }
  }, [scanId, authLoading, isAuthenticated, fetchHistory]);

  // Send message
  const handleSend = async () => {
    const message = input.trim();
    if (!message || sending || !scanId) return;
    if (credits != null && credits <= 0) return;

    setInput('');
    setSending(true);
    setInlineError(null);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    analytics.chatMessageSent(scanId);
    soundEffects.play('chatSend');

    try {
      const res = await fetch(`/api/chat/${scanId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      if (res.status === 402) {
        const data = await res.json();
        if (data.error === 'chat_activation_required') {
          setErrorState({ type: 'activation', message: 'Activate GhostChat™ to start chatting.' });
        } else {
          // no_credits_remaining — set credits to 0 to show purchase CTA
          setCredits(0);
        }
        setSending(false);
        return;
      }

      if (res.status === 403) {
        setErrorState({ type: 'not_paid', message: 'Alpha Brief required to chat about this scan.' });
        setSending(false);
        return;
      }

      if (res.status === 429) {
        setInlineError('Too many messages. Wait a moment.');
        setSending(false);
        return;
      }

      if (res.status === 503) {
        setInlineError('AI service temporarily unavailable. No credit charged.');
        setSending(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setInlineError(data.error ?? 'Something went wrong.');
        setSending(false);
        return;
      }

      const data = await res.json();
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setCredits(data.creditsRemaining);
      soundEffects.play('chatReceive');
    } catch {
      setInlineError('Connection lost. Try again.');
    } finally {
      setSending(false);
    }
  };

  // Open payment window for credits
  const openCreditPurchase = useCallback((product: string) => {
    if (!scanId) return;
    const paymentId = `payment-chat-${scanId}`;
    wm.registerWindow(paymentId, {
      title: 'Purchase Credits',
      width: 420,
      height: 300,
      variant: 'dialog',
      componentType: 'payment',
    });
    wm.openWindow(paymentId, {
      scanId,
      domain,
      product,
    });
  }, [wm, scanId, domain]);

  // ── Loading state ──────────────────────────────────────────
  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center h-full p-gs-6">
        <div className="text-center">
          <ChloeSprite state="chat" size={32} glowing />
          <p className="font-data text-data-sm text-gs-muted mt-gs-3 animate-blink">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  // ── Error states (full-window) ─────────────────────────────
  if (errorState) {
    return (
      <div className="flex items-center justify-center h-full p-gs-6">
        <div className="text-center space-y-gs-3" style={{ maxWidth: 280 }}>
          <ChloeSprite state="idle" size={32} />
          <p className="font-data text-data-sm text-gs-muted leading-relaxed">
            {errorState.message}
          </p>
          {errorState.type === 'auth' && (
            <button
              onClick={() => wm.openWindow('auth')}
              className="bevel-button-primary text-os-xs px-gs-4"
            >
              Log In
            </button>
          )}
          {errorState.type === 'activation' && (
            <button
              onClick={() => openCreditPurchase('chat_credits_15')}
              className="bevel-button-primary text-os-xs px-gs-4"
            >
              Activate — $1.00
            </button>
          )}
          {errorState.type === 'not_paid' && (
            <p className="font-data text-data-xs text-gs-mid">
              Upgrade this scan to Alpha Brief to unlock chat.
            </p>
          )}
          {errorState.type === 'fetch_error' && (
            <button
              onClick={() => { hasFetched.current = false; fetchHistory(); }}
              className="bevel-button text-os-xs px-gs-4"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Main chat UI ───────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-gs-3 py-gs-3 space-y-gs-3">
        {messages.length === 0 && !sending && (
          <div className="text-center py-gs-6">
            <ChloeSprite state="chat" size={32} glowing className="mx-auto mb-gs-3" />
            <p className="font-data text-data-sm text-gs-muted leading-relaxed">
              Ask me anything about your scan results.
              <br />
              <span className="text-gs-mid" style={{ fontSize: '11px' }}>
                I cite specific modules as evidence.
              </span>
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex gap-gs-2',
              msg.role === 'user' ? 'justify-end' : 'justify-start',
            )}
          >
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 mt-0.5">
                <GhostIcon size={18} />
              </div>
            )}
            <div
              className={cn(
                'max-w-[88%] px-gs-3 py-gs-2 rounded-lg',
                msg.role === 'user'
                  ? 'bevel-raised font-data text-data-sm'
                  : '',
              )}
              style={
                msg.role === 'user'
                  ? { background: 'oklch(0.16 0.02 340)', color: 'var(--gs-light)' }
                  : {
                      background: 'oklch(0.10 0.01 340 / 0.6)',
                      borderLeft: '2px solid var(--gs-base)',
                    }
              }
            >
              {msg.role === 'user' ? (
                <p className="font-data text-data-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--gs-light)' }}>
                  {msg.content}
                </p>
              ) : (
                <ReactMarkdown components={chatMarkdownComponents as never}>
                  {msg.content}
                </ReactMarkdown>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {sending && (
          <div className="flex gap-gs-2 justify-start">
            <div className="flex-shrink-0 mt-0.5">
              <GhostIcon size={18} />
            </div>
            <div
              className="px-gs-3 py-gs-2 rounded-lg"
              style={{
                background: 'oklch(0.10 0.01 340 / 0.6)',
                borderLeft: '2px solid var(--gs-base)',
              }}
            >
              <div className="flex gap-1 items-center" style={{ height: 18 }}>
                <span className="w-[5px] h-[5px] rounded-full bg-gs-base animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-[5px] h-[5px] rounded-full bg-gs-base animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-[5px] h-[5px] rounded-full bg-gs-base animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Inline error */}
      {inlineError && (
        <div className="px-gs-3 py-gs-1 flex-shrink-0" style={{ background: 'oklch(0.12 0.02 15 / 0.3)' }}>
          <p className="font-data text-gs-critical" style={{ fontSize: '11px' }}>
            {inlineError}
          </p>
        </div>
      )}

      {/* Input area */}
      <div
        className="px-gs-3 flex-shrink-0"
        style={{ borderTop: '1px solid oklch(0.20 0.02 340 / 0.6)' }}
      >
        {/* Credits bar */}
        <div className="flex items-center justify-between py-1.5">
          <span className="font-data tabular-nums" style={{ fontSize: '10px', color: 'oklch(0.45 0.03 340)' }}>
            <span style={{ color: 'var(--gs-base)', fontWeight: 600 }}>{credits ?? 0}</span>
            {' '}credits
          </span>
          {credits != null && credits <= 5 && credits > 0 && (
            <button
              onClick={() => openCreditPurchase('chat_credits')}
              className="font-data hover:opacity-80 transition-opacity"
              style={{ fontSize: '10px', color: 'oklch(0.45 0.03 340)' }}
            >
              + more
            </button>
          )}
        </div>
        {credits != null && credits <= 0 ? (
          <div className="pb-gs-2">
            <button
              onClick={() => openCreditPurchase('chat_credits')}
              className="w-full bevel-button-primary"
              style={{ fontSize: '12px', height: 32 }}
            >
              Purchase credits to continue
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-gs-2 pb-gs-2"
          >
            <BevelInput
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Chloé anything..."
              disabled={sending}
              fullWidth
              className="!text-data-sm !min-h-[32px] !py-gs-1"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="bevel-button-primary flex-shrink-0 disabled:opacity-40"
              style={{ fontSize: '12px', padding: '0 12px', height: 32 }}
            >
              Send
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
