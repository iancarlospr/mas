'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import type { ChloeState } from './chloe-sprite';
import {
  pickRandom,
  SCAN_EVENTS,
  DASHBOARD_EVENTS,
  PAYMENT_EVENTS,
  CHAT_EVENTS,
  IDLE_QUIPS,
  MISCHIEF_LINES,
  ERROR_STATES,
} from '@/lib/chloe-ai-copy';

/**
 * GhostScan OS — Chloé Reactions System
 * ═══════════════════════════════════════
 *
 * WHAT: A React context + event system that triggers Chloé's emotional
 *       state changes and speech bubbles in response to app events.
 * WHY:  Chloé isn't decoration — she's the product's voice. When a critical
 *       finding appears, she reacts. When the scan completes, she celebrates.
 *       This system makes her feel ALIVE (Plan Section 4).
 * HOW:  Context provider wraps the app. Any component can call
 *       `useChloeReactions()` to trigger events. The context manages
 *       current state, speech queue, and idle behavior.
 *
 * Events flow: Component → triggerReaction() → state change + speech bubble
 */

/* ── Reaction Event Types ──────────────────────────────────── */

export type ChloeReactionEvent =
  | { type: 'scan-start' }
  | { type: 'module-complete'; moduleId: string }
  | { type: 'critical-found'; moduleId: string; moduleName: string }
  | { type: 'scan-complete'; moduleCount: number; findingCount: number; criticalCount: number; score: number }
  | { type: 'scan-failed'; domain: string }
  | { type: 'scan-cached' }
  | { type: 'redacted-hover' }
  | { type: 'perfect-module' }
  | { type: 'critical-module'; moduleName: string }
  | { type: 'ghost-module' }
  | { type: 'declassify-prompt' }
  | { type: 'declassified' }
  | { type: 'purchase-cancelled' }
  | { type: 'chat-no-credits' }
  | { type: 'chat-activated' }
  | { type: 'chat-greeting'; domain: string }
  | { type: 'error-rate-limited' }
  | { type: 'error-empty' }
  | { type: 'error-partial'; count: number }
  | { type: 'error-module'; domain: string }
  | { type: 'idle-quip' }
  | { type: 'mischief' };

/* ── Context State ─────────────────────────────────────────── */

interface ChloeReactionState {
  /** Current emotional state for the sprite */
  state: ChloeState;
  /** Current speech bubble message (null = no bubble) */
  speech: string | null;
  /** Speech variant */
  speechVariant: 'normal' | 'alert' | 'ghost';
  /** Whether Chloé is currently reacting (prevents interruption) */
  isReacting: boolean;
}

interface ChloeReactionsContextValue extends ChloeReactionState {
  /** Trigger a reaction event */
  triggerReaction: (event: ChloeReactionEvent) => void;
  /** Manually set Chloé's state (for screenmate override) */
  setState: (state: ChloeState) => void;
  /** Dismiss current speech bubble */
  dismissSpeech: () => void;
}

const ChloeReactionsContext = createContext<ChloeReactionsContextValue | null>(null);

/* ── Provider ──────────────────────────────────────────────── */

export function ChloeReactionsProvider({ children }: { children: ReactNode }) {
  const [reaction, setReaction] = useState<ChloeReactionState>({
    state: 'idle',
    speech: null,
    speechVariant: 'normal',
    isReacting: false,
  });

  /** Timer ref for auto-return to idle */
  const returnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Set a reaction with auto-return to idle after duration.
   * If currently reacting and priority is low, queue is ignored.
   */
  const setReactionWithTimeout = useCallback(
    (
      state: ChloeState,
      speech: string | null,
      speechVariant: 'normal' | 'alert' | 'ghost' = 'normal',
      durationMs: number = 4000,
    ) => {
      /* Clear any pending return-to-idle timer */
      if (returnTimerRef.current) clearTimeout(returnTimerRef.current);

      setReaction({
        state,
        speech,
        speechVariant,
        isReacting: true,
      });

      /* Auto-return to idle after duration */
      returnTimerRef.current = setTimeout(() => {
        setReaction({
          state: 'idle',
          speech: null,
          speechVariant: 'normal',
          isReacting: false,
        });
      }, durationMs);
    },
    [],
  );

  /** Template string replacement for dynamic copy */
  const template = useCallback((str: string, vars: Record<string, string | number>) => {
    let result = str;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(`{${key}}`, String(value));
    }
    return result;
  }, []);

  /** Main event handler — maps events to state + speech */
  const triggerReaction = useCallback(
    (event: ChloeReactionEvent) => {
      switch (event.type) {
        case 'scan-start':
          setReactionWithTimeout('scanning', pickRandom(SCAN_EVENTS.start), 'ghost', 6000);
          break;

        case 'module-complete':
          /* Brief acknowledgment — don't interrupt longer reactions */
          if (!reaction.isReacting || reaction.state === 'scanning') {
            setReactionWithTimeout('scanning', pickRandom(SCAN_EVENTS.moduleComplete), 'normal', 1500);
          }
          break;

        case 'critical-found':
          setReactionWithTimeout(
            'critical',
            template(pickRandom(SCAN_EVENTS.criticalFound), { module: event.moduleName }),
            'alert',
            5000,
          );
          break;

        case 'scan-complete':
          setReactionWithTimeout(
            'celebrating',
            template(pickRandom(SCAN_EVENTS.complete), {
              moduleCount: event.moduleCount,
              findingCount: event.findingCount,
              criticalCount: event.criticalCount,
              score: event.score,
            }),
            'ghost',
            6000,
          );
          break;

        case 'scan-failed':
          setReactionWithTimeout(
            'found',
            template(pickRandom(SCAN_EVENTS.failed), { domain: event.domain }),
            'alert',
            5000,
          );
          break;

        case 'scan-cached':
          setReactionWithTimeout('smug', pickRandom(SCAN_EVENTS.cached), 'normal', 4000);
          break;

        case 'redacted-hover':
          setReactionWithTimeout('mischief', pickRandom(DASHBOARD_EVENTS.redactedHover), 'normal', 3000);
          break;

        case 'perfect-module':
          setReactionWithTimeout('smug', pickRandom(DASHBOARD_EVENTS.perfectScore), 'normal', 3000);
          break;

        case 'critical-module':
          setReactionWithTimeout(
            'critical',
            template(pickRandom(DASHBOARD_EVENTS.criticalScore), { module: event.moduleName }),
            'alert',
            4000,
          );
          break;

        case 'ghost-module':
          setReactionWithTimeout('smug', pickRandom(DASHBOARD_EVENTS.ghostModule), 'ghost', 3000);
          break;

        case 'declassify-prompt':
          setReactionWithTimeout('chat', pickRandom(PAYMENT_EVENTS.declassifyPrompt), 'ghost', 5000);
          break;

        case 'declassified':
          setReactionWithTimeout('celebrating', pickRandom(PAYMENT_EVENTS.declassified), 'ghost', 5000);
          break;

        case 'purchase-cancelled':
          setReactionWithTimeout('idle', pickRandom(PAYMENT_EVENTS.cancelled), 'normal', 4000);
          break;

        case 'chat-no-credits':
          setReactionWithTimeout('smug', pickRandom(CHAT_EVENTS.noCreditGate), 'normal', 5000);
          break;

        case 'chat-activated':
          setReactionWithTimeout('celebrating', pickRandom(PAYMENT_EVENTS.chatActivated), 'ghost', 4000);
          break;

        case 'chat-greeting':
          setReactionWithTimeout(
            'chat',
            template(pickRandom(CHAT_EVENTS.chatGreeting), { domain: event.domain }),
            'normal',
            5000,
          );
          break;

        case 'error-rate-limited':
          setReactionWithTimeout('smug', pickRandom(ERROR_STATES.rateLimited), 'alert', 5000);
          break;

        case 'error-empty':
          setReactionWithTimeout('idle', pickRandom(ERROR_STATES.empty), 'normal', 4000);
          break;

        case 'error-partial':
          setReactionWithTimeout(
            'found',
            template(pickRandom(ERROR_STATES.partial), { count: event.count }),
            'alert',
            5000,
          );
          break;

        case 'error-module':
          setReactionWithTimeout(
            'idle',
            template(pickRandom(ERROR_STATES.moduleUnavailable), { domain: event.domain }),
            'normal',
            4000,
          );
          break;

        case 'idle-quip':
          setReactionWithTimeout('idle', pickRandom(IDLE_QUIPS), 'normal', 5000);
          break;

        case 'mischief':
          setReactionWithTimeout('mischief', pickRandom(MISCHIEF_LINES), 'normal', 3000);
          break;
      }
    },
    [reaction.isReacting, reaction.state, setReactionWithTimeout, template],
  );

  const setState = useCallback((state: ChloeState) => {
    setReaction((prev) => ({ ...prev, state }));
  }, []);

  const dismissSpeech = useCallback(() => {
    setReaction((prev) => ({ ...prev, speech: null }));
  }, []);

  const value = useMemo<ChloeReactionsContextValue>(
    () => ({
      ...reaction,
      triggerReaction,
      setState,
      dismissSpeech,
    }),
    [reaction, triggerReaction, setState, dismissSpeech],
  );

  return (
    <ChloeReactionsContext.Provider value={value}>
      {children}
    </ChloeReactionsContext.Provider>
  );
}

/* ── Hook ──────────────────────────────────────────────────── */

export function useChloeReactions(): ChloeReactionsContextValue {
  const ctx = useContext(ChloeReactionsContext);
  if (!ctx) {
    throw new Error('useChloeReactions must be used within ChloeReactionsProvider');
  }
  return ctx;
}
