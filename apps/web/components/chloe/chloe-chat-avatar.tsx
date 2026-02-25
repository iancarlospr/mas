'use client';

import { ChloeSprite, type ChloeState } from './chloe-sprite';
import { cn } from '@/lib/utils';

/**
 * GhostScan OS — Chloé Chat Avatar
 * ═══════════════════════════════════════
 *
 * WHAT: A smaller, static version of Chloé for the chat window.
 * WHY:  In the chat, Chloé is the conversation partner — like Clippy
 *       but with attitude. Her avatar sits at the top of the chat window
 *       or appears as a small icon next to her messages (Plan Section 7).
 * HOW:  Wraps ChloeSprite at 32px with chat-specific states:
 *       - Listening (idle but attentive)
 *       - Typing (subtle animation — blinking, slight movement)
 *       - Thinking (scanning state — eyes bright)
 *       - Responding (chat state)
 *
 * Used in: chat-interface.tsx (message avatar), chat window header.
 */

export type ChatAvatarMode = 'listening' | 'typing' | 'thinking' | 'responding';

interface ChloeChatAvatarProps {
  /** Current chat behavior mode */
  mode?: ChatAvatarMode;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show the cyan ring indicator */
  showRing?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/** Map chat modes → sprite emotional states */
const MODE_TO_STATE: Record<ChatAvatarMode, ChloeState> = {
  listening: 'chat',
  typing: 'scanning',
  thinking: 'scanning',
  responding: 'chat',
};

/** Size presets */
const SIZE_MAP = {
  sm: 32,
  md: 48,
  lg: 64,
} as const;

export function ChloeChatAvatar({
  mode = 'listening',
  size = 'sm',
  showRing = true,
  className,
}: ChloeChatAvatarProps) {
  const spriteState = MODE_TO_STATE[mode];
  const pixelSize = SIZE_MAP[size];

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center flex-shrink-0',
        className,
      )}
      style={{
        width: pixelSize + 8,
        height: pixelSize + 8,
      }}
    >
      {/* Status ring */}
      {showRing && (
        <div
          className={cn(
            'absolute inset-0 rounded-full',
            mode === 'typing' && 'animate-ghost-pulse',
          )}
          style={{
            border: '2px solid var(--gs-red)',
            boxShadow: mode === 'typing'
              ? '0 0 8px var(--gs-red), inset 0 0 4px oklch(0.82 0.08 192 / 0.2)'
              : '0 0 4px oklch(0.82 0.08 192 / 0.2)',
          }}
        />
      )}

      {/* Chloé sprite */}
      <ChloeSprite
        state={spriteState}
        size={pixelSize as 32 | 64}
        glowing={mode === 'typing' || mode === 'thinking'}
      />

      {/* Typing indicator dots */}
      {mode === 'typing' && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-[2px]">
          <span
            className="w-[4px] h-[4px] rounded-full bg-gs-red animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-[4px] h-[4px] rounded-full bg-gs-red animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-[4px] h-[4px] rounded-full bg-gs-red animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Inline message avatar — tiny Chloé next to chat messages.
 * Used in chat bubble lists to indicate who is speaking.
 */
export function ChloeMessageAvatar({ className }: { className?: string }) {
  return (
    <ChloeChatAvatar
      mode="responding"
      size="sm"
      showRing={false}
      className={className}
    />
  );
}
