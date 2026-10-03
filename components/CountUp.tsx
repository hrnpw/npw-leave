'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface CountUpProps {
  end: number;
  /** milliseconds */
  duration?: number;
  suffix?: string;
}

export function CountUp({ end, duration = 1000, suffix = '' }: CountUpProps) {
  const reduceMotion = useReducedMotion();
  const [count, setCount] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (reduceMotion) {
      fromRef.current = end;
      return;
    }

    const from = fromRef.current;
    let startTime: number | undefined;
    let frame: number;

    const tick = (now: number) => {
      startTime ??= now;
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(from + (end - from) * eased);
      fromRef.current = value;
      setCount(value);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [end, duration, reduceMotion]);

  return (
    <motion.span
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {reduceMotion ? end : count}
      {suffix}
    </motion.span>
  );
}
