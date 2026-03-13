'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { RESOLVED_COLORS } from '@/lib/chart-config';
import { TrafficLight } from '@/components/scan/traffic-light';

type CardSize = '1x1' | '2x1' | '1x2' | '2x2';

interface BentoCardProps {
  moduleId?: string;
  title: string;
  score?: number;
  status?: 'green' | 'amber' | 'red';
  size: CardSize;
  expanded?: boolean;
  onToggleExpand?: () => void;
  children: React.ReactNode;
  expandedContent?: React.ReactNode;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

const SIZE_CLASSES: Record<CardSize, string> = {
  '1x1': 'bento-card-1x1',
  '2x1': 'bento-card-2x1',
  '1x2': 'bento-card-1x2',
  '2x2': 'bento-card-2x2',
};

export function BentoCard({
  title,
  score,
  status,
  size,
  expanded = false,
  onToggleExpand,
  children,
  expandedContent,
  isLoading,
  error,
  className,
}: BentoCardProps) {
  return (
    <motion.div
      className={cn(
        'bg-white rounded-2xl overflow-hidden',
        'transition-shadow duration-200',
        SIZE_CLASSES[size],
        className,
      )}
      style={{
        border: `1px solid ${RESOLVED_COLORS.chromeLight}`,
        boxShadow: '0 1px 3px oklch(0.15 0.01 80 / 0.04), 0 4px 16px oklch(0.15 0.01 80 / 0.03)',
        padding: '20px',
      }}
      whileHover={{
        boxShadow: '0 4px 24px oklch(0.15 0.01 80 / 0.08)',
      }}
      layout
    >
      {/* Card header */}
      <div className="flex items-center justify-between mb-3">
        <h3
          style={{
            fontFamily: 'var(--font-system)',
            fontWeight: 600,
            fontSize: 15,
            color: RESOLVED_COLORS.ink,
          }}
        >
          {title}
        </h3>
        <div className="flex items-center gap-2">
          {score !== undefined && (
            <span
              style={{
                fontFamily: 'var(--font-data)',
                fontSize: 14,
                fontWeight: 700,
                color: RESOLVED_COLORS.ink,
              }}
            >
              {score}
            </span>
          )}
          {status && <TrafficLight status={status} size="sm" dotOnly showIcon />}
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="ml-1 p-0.5 rounded hover:bg-gs-chrome transition-colors"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              <svg
                width={16}
                height={16}
                viewBox="0 0 16 16"
                fill="none"
                className="transition-transform duration-200"
                style={{ transform: expanded ? 'rotate(180deg)' : undefined }}
              >
                <path d="M4 6l4 4 4-4" stroke={RESOLVED_COLORS.chrome} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Divider when expanded */}
      {expanded && <div className="border-b border-gs-chrome mb-3" />}

      {/* Error state */}
      {error && (
        <div
          className="flex flex-col items-center justify-center text-center py-4"
          style={{ backgroundColor: 'oklch(0.55 0.22 25 / 0.03)', borderRadius: 8 }}
        >
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" className="mb-2">
            <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke={RESOLVED_COLORS.critical} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p style={{ fontSize: 13, color: RESOLVED_COLORS.muted }}>{error}</p>
        </div>
      )}

      {/* Loading state */}
      {isLoading && !error && (
        <div className="animate-pulse space-y-2 py-4">
          <div className="h-4 bg-gs-chrome rounded w-3/4" />
          <div className="h-4 bg-gs-chrome rounded w-1/2" />
          <div className="h-20 bg-gs-chrome rounded" />
        </div>
      )}

      {/* Content */}
      {!isLoading && !error && children}

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && expandedContent && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pt-3 border-t border-gs-chrome mt-3">
              {expandedContent}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
