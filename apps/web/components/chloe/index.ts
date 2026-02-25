/**
 * GhostScan OS — Chloé Component Library
 *
 * Chloé is the ghost. She IS GhostScan personified.
 * Pixel art mascot, screenmate, chat companion, brand voice.
 * Cute but implies she could ruin your life.
 */

// Core sprite renderer
export { ChloeSprite } from './chloe-sprite';
export type { ChloeState, ChloeSpriteProps } from './chloe-sprite';

// Speech bubble
export { ChloeSpeech, ChloeTypingBubble } from './chloe-speech';
export type { ChloeSpeechProps, SpeechVariant } from './chloe-speech';

// Reactions system (context + hook)
export { ChloeReactionsProvider, useChloeReactions } from './chloe-reactions';
export type { ChloeReactionEvent } from './chloe-reactions';

// Desktop screenmate
export { ChloeScreenmate } from './chloe-screenmate';

// Chat avatar
export { ChloeChatAvatar, ChloeMessageAvatar } from './chloe-chat-avatar';
export type { ChatAvatarMode } from './chloe-chat-avatar';
