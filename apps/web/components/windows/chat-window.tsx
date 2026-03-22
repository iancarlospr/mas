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

// ── Copyable AI message wrapper — floating tooltip follows cursor ────
function CopyableMessage({ text, children }: { text: string; children: ReactNode }) {
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!tooltipRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top - 28;
    tooltipRef.current.style.transform = `translate(${x}px, ${y}px)`;
  }, []);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard not available */ }
  };

  return (
    <div
      className="relative"
      style={{ cursor: 'pointer' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setCopied(false); }}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
    >
      {children}
      {hovered && (
        <div
          ref={tooltipRef}
          className="pointer-events-none"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            willChange: 'transform',
            background: 'oklch(0.16 0.02 340)',
            border: '1px solid oklch(0.28 0.02 340)',
            borderRadius: 5,
            padding: '3px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}
        >
          {copied ? (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--gs-terminal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="font-data" style={{ fontSize: '10px', color: 'var(--gs-terminal)' }}>Copied</span>
            </>
          ) : (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="oklch(0.60 0.03 340)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span className="font-data" style={{ fontSize: '10px', color: 'oklch(0.55 0.03 340)' }}>Copy</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

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
    <div className="flex flex-col" style={{ height: windowState?.isMaximized ? '100%' : (windowState?.height ? (windowState.height - 32) : 448), minHeight: 0 }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-gs-3 space-y-gs-4 select-text" style={{ paddingLeft: 10, paddingRight: 10, minHeight: 0 }}>
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
          <div key={msg.id}>
            {msg.role === 'user' ? (
              /* User message — pill, right-aligned */
              <div className="flex justify-end">
                <div
                  className="font-data text-data-sm whitespace-pre-wrap leading-relaxed"
                  style={{
                    background: 'oklch(0.20 0.03 340)',
                    color: 'var(--gs-light)',
                    padding: '6px 12px',
                    borderRadius: '12px 12px 2px 12px',
                    maxWidth: '85%',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ) : (
              /* Chloé message — click anywhere to copy, tooltip follows cursor */
              <CopyableMessage text={msg.content}>
                <div className="flex items-center gap-1.5 mb-1">
                  <GhostIcon size={12} />
                  <span className="font-data" style={{ fontSize: '10px', color: 'oklch(0.45 0.04 340)' }}>Chlo&eacute;</span>
                </div>
                <div
                  style={{
                    borderLeft: '2px solid var(--gs-base)',
                    paddingLeft: 10,
                  }}
                >
                  <ReactMarkdown components={chatMarkdownComponents as never}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </CopyableMessage>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {sending && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <GhostIcon size={12} />
              <span className="font-data" style={{ fontSize: '10px', color: 'oklch(0.45 0.04 340)' }}>Chlo&eacute;</span>
            </div>
            <div style={{ borderLeft: '2px solid var(--gs-base)', paddingLeft: 10 }}>
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

      {/* Fused input block — one solid piece */}
      <div className="flex-shrink-0 mx-gs-3 mb-gs-2" style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid oklch(0.25 0.02 340)' }}>
        {credits != null && credits <= 0 ? (
          <button
            onClick={() => openCreditPurchase('chat_credits')}
            className="w-full"
            style={{
              height: 38,
              fontSize: '12px',
              fontFamily: 'var(--font-data)',
              fontWeight: 600,
              color: 'var(--gs-light)',
              background: 'oklch(0.14 0.02 340)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Purchase credits to continue
          </button>
        ) : (
          <div className="flex items-stretch" style={{ background: 'var(--gs-light)', height: 36 }}>
            {/* Input — fills available space */}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask Chloé anything..."
              disabled={sending}
              className="font-data select-text"
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                padding: '0 12px',
                fontSize: '13px',
                color: 'var(--gs-void)',
                caretColor: 'var(--gs-void)',
              }}
            />
            {/* Credits badge — fused between input and send */}
            <div
              className="flex items-center gap-1 flex-shrink-0"
              style={{
                padding: '0 8px',
                borderLeft: '1px solid oklch(0.88 0.01 340)',
                color: 'oklch(0.55 0.04 340)',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.7 }}>
                <path d="M8 1C5.2 1 3 3.2 3 6v6l1-1.5 1 1.5 1-1.5 1 1.5 1-1.5 1 1.5 1-1.5 1 1.5V6c0-2.8-2.2-5-5-5z"/>
                <circle cx="6" cy="5.5" r="1" fill="var(--gs-light)"/>
                <circle cx="10" cy="5.5" r="1" fill="var(--gs-light)"/>
              </svg>
              <span className="font-data tabular-nums font-semibold" style={{ fontSize: '11px' }}>
                {credits ?? 0}
              </span>
            </div>
            {/* Send button — fused right edge */}
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="flex-shrink-0 disabled:opacity-30 transition-opacity"
              style={{
                width: 42,
                background: 'oklch(0.14 0.02 340)',
                border: 'none',
                borderLeft: '1px solid oklch(0.25 0.02 340)',
                cursor: sending || !input.trim() ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gs-base)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        )}
        {/* Progress bar — bottom edge of the fused block */}
        <div style={{ height: 2, background: 'oklch(0.13 0.01 340)' }}>
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, ((credits ?? 0) / 100) * 100)}%`,
              background: (credits ?? 0) > 20
                ? 'var(--gs-base)'
                : (credits ?? 0) > 5
                  ? 'var(--gs-warning)'
                  : 'var(--gs-critical)',
              transition: 'width 0.4s ease, background 0.4s ease',
              opacity: 0.8,
            }}
          />
        </div>
      </div>
    </div>
  );
}
