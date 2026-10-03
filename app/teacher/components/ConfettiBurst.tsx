'use client';

import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const COLORS = ['#f97316', '#0ea5e9', '#10b981', '#facc15', '#ec4899', '#8b5cf6'];
const COUNT = 36;

export function ConfettiBurst() {
  const reduceMotion = useReducedMotion();

  const pieces = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        id: i,
        color: COLORS[i % COLORS.length],
        dx: (Math.random() - 0.5) * 340,
        peak: -(140 + Math.random() * 140),
        fall: 260 + Math.random() * 200,
        spin: (Math.random() - 0.5) * 1080,
        duration: 1.6 + Math.random() * 0.8,
        width: 6 + Math.random() * 4,
        height: 10 + Math.random() * 4,
      })),
    []
  );

  if (reduceMotion) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      <div className="absolute left-1/2 top-[40%]">
        {pieces.map((p) => (
          <motion.span
            key={p.id}
            className="absolute block rounded-[2px]"
            style={{ backgroundColor: p.color, width: p.width, height: p.height }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{
              x: [0, p.dx * 0.6, p.dx],
              y: [0, p.peak, p.fall],
              opacity: [1, 1, 0],
              rotate: p.spin,
            }}
            transition={{
              duration: p.duration,
              times: [0, 0.35, 1],
              ease: ['easeOut', 'easeIn'],
            }}
          />
        ))}
      </div>
    </div>
  );
}
