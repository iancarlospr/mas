'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { analytics } from '@/lib/analytics';
import { soundEffects } from '@/lib/sound-effects';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';
import { BevelInput } from '@/components/os/bevel-input';

/**
 * GhostScan OS — Chat Interface (Ask Chloe Window)
 * ═══════════════════════════════════════════════════
 *
 * WHAT: AI chat with Chloe rendered as a retro OS chat window.
 * WHY:  The chat IS Chloe — she's the AI analyst who knows your scan
 *       data. Retro bubble styling, her sprite as avatar, credits as
 *       gems in the status area (Plan Section 7).
 * HOW:  Chloe messages left-aligned with cyan accent border, user
 *       messages right-aligned with bevel style, typing indicator
 *       with bouncing dots, bevel input + send button.
 */

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface ChatInterfaceProps {
  scanId: string;
  initialMessages: Message[];
  initialCredits: number;
}

export function ChatInterface({ scanId, initialMessages, initialCredits }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [credits, setCredits] = useState(initialCredits);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const message = input.trim();
    if (!message || loading || credits <= 0) return;

    setInput('');
    setLoading(true);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
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

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to send message');
      }

      const data = await res.json();
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setCredits(data.creditsRemaining);
      soundEffects.play('chatReceive');
    } catch (err) {
      const errMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `${err instanceof Error ? err.message : 'Connection lost. Try again.'}`,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chloe header */}
      <div className="flex items-center gap-gs-3 p-gs-4 border-b-2 border-gs-chrome">
        <ChloeSprite state={loading ? 'scanning' : 'chat'} size={32} />
        <div className="flex-1">
          <h2 className="font-system text-os-sm font-bold text-gs-ink">
            Ask Chloe
          </h2>
          <span className="font-data text-data-xs text-gs-muted">
            {loading ? 'Analyzing...' : 'Ready'}
          </span>
        </div>
        <div className="bevel-sunken bg-gs-paper px-gs-3 py-gs-1">
          <span className="font-data text-data-xs text-gs-muted">
            {credits} credits
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-gs-4 space-y-gs-4">
        {messages.length === 0 && (
          <div className="text-center py-gs-8">
            <ChloeSprite state="chat" size={64} glowing className="mx-auto mb-gs-4" />
            <p className="font-data text-data-sm text-gs-muted">
              Ask me anything about your scan results.
              <br />
              I cite specific modules as evidence.
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
              <div className="flex-shrink-0 mt-gs-1">
                <ChloeSprite state="chat" size={32} />
              </div>
            )}
            <div
              className={cn(
                'max-w-[80%] px-gs-4 py-gs-3',
                msg.role === 'user'
                  ? 'bevel-raised bg-gs-chrome font-data text-data-sm text-gs-ink'
                  : 'bevel-sunken bg-gs-paper font-data text-data-sm text-gs-muted border-l-2 border-gs-red',
              )}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-gs-2 justify-start">
            <div className="flex-shrink-0 mt-gs-1">
              <ChloeSprite state="scanning" size={32} />
            </div>
            <div className="bevel-sunken bg-gs-paper px-gs-4 py-gs-3 border-l-2 border-gs-red">
              <div className="flex gap-gs-1">
                <span className="w-[6px] h-[6px] bg-gs-red animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-[6px] h-[6px] bg-gs-red animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-[6px] h-[6px] bg-gs-red animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-gs-4 border-t-2 border-gs-chrome">
        {credits <= 0 ? (
          <div className="bevel-sunken bg-gs-paper p-gs-3 text-center">
            <p className="font-data text-data-xs text-gs-muted">
              No credits remaining.{' '}
              <a href="#" className="text-gs-red hover:underline font-bold">
                Purchase more
              </a>
            </p>
          </div>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-gs-2"
          >
            <BevelInput
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Chloe anything..."
              disabled={loading}
              fullWidth
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bevel-button-primary text-os-sm px-gs-4 flex-shrink-0 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
