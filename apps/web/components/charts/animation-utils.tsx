'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useSpring, useTransform, AnimatePresence, useReducedMotion } from 'framer-motion';

// 4.1 Scroll-Triggered Animation wrapper
export function ScrollReveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// 4.2 Staggered Card Entrance variants
export const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export const cardVariants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.45,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

// 4.4 Score Count-Up Hook
export function useCountUp(target: number, duration: number = 2000) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref as React.RefObject<HTMLElement>, { once: true });
  const [display, setDisplay] = useState(0);

  const spring = useSpring(0, { duration, bounce: 0 });
  const rounded = useTransform(spring, (v) => Math.round(v));

  useEffect(() => {
    if (isInView) spring.set(target);
  }, [isInView, target, spring]);

  useEffect(() => {
    const unsub = rounded.on('change', (v) => setDisplay(v));
    return unsub;
  }, [rounded]);

  return { ref, display };
}

// 4.5 Animated Number for live-updating values
export function AnimatedNumber({
  value,
  format = String,
  className,
}: {
  value: number;
  format?: (v: number) => string;
  className?: string;
}) {
  const [display, setDisplay] = useState(format(value));
  const spring = useSpring(value, { stiffness: 100, damping: 30 });
  const transformed = useTransform(spring, (v) => format(Math.round(v)));

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  useEffect(() => {
    const unsub = transformed.on('change', (v) => setDisplay(v));
    return unsub;
  }, [transformed]);

  return <span className={className}>{display}</span>;
}

// 4.6 Hover presets
export const hoverScale = {
  whileHover: { scale: 1.02, transition: { duration: 0.2 } },
  whileTap: { scale: 0.98, transition: { duration: 0.1 } },
};

export const hoverElevate = {
  whileHover: {
    y: -2,
    boxShadow: '0 8px 32px oklch(0.15 0.01 80 / 0.12)',
    transition: { duration: 0.2 },
  },
};

// 4.7 Loading to Data transition
export function ChartWithSkeleton({
  isLoading,
  skeleton,
  chart,
}: {
  isLoading: boolean;
  skeleton: React.ReactNode;
  chart: React.ReactNode;
}) {
  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.3 }}
        >
          {skeleton}
        </motion.div>
      ) : (
        <motion.div
          key="chart"
          initial={{ opacity: 0, scale: 1.01 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {chart}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// 4.9 Reduced Motion hook
export function useAnimationConfig() {
  const prefersReducedMotion = useReducedMotion();

  return {
    duration: prefersReducedMotion ? 0 : undefined,
    staggerChildren: prefersReducedMotion ? 0 : 0.08,
    isAnimationActive: !prefersReducedMotion,
  };
}
