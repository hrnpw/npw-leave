'use client';

import { motion, useTransform, type MotionValue } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import type { PullState } from '@/hooks/usePullToRefresh';

interface PullToRefreshIndicatorProps {
  pull: MotionValue<number>;
  state: PullState;
  threshold: number;
}

export function PullToRefreshIndicator({ pull, state, threshold }: PullToRefreshIndicatorProps) {
  const y = useTransform(pull, (v) => v - 48);
  const opacity = useTransform(pull, [0, 24], [0, 1]);
  const rotate = useTransform(pull, [0, threshold], [0, 270]);

  return (
    <>
      <span role="status" className="sr-only">
        {state === 'refreshing' ? 'กำลังรีเฟรชข้อมูล' : ''}
      </span>
      <motion.div
        aria-hidden
        style={{ y, opacity }}
        className="pointer-events-none fixed top-0 inset-x-0 z-40 flex justify-center"
      >
        <div className="bg-white dark:bg-slate-800 rounded-full p-2 shadow-lg shadow-slate-300/50 dark:shadow-slate-950/80">
          <motion.div style={{ rotate: state === 'refreshing' ? 0 : rotate }}>
            <RefreshCw
              className={`w-5 h-5 transition-colors ${
                state === 'idle'
                  ? 'text-sky-600 dark:text-sky-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              } ${state === 'refreshing' ? 'animate-spin' : ''}`}
            />
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}
