'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, useMotionValue } from 'framer-motion';

export type PullState = 'idle' | 'ready' | 'refreshing';

interface Options {
  enabled?: boolean;
  threshold?: number;
  maxPull?: number;
}

const RESISTANCE = 0.5;
const ACTIVATE_PX = 10;
const SETTLE = { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const };

export function usePullToRefresh(
  onRefresh: () => Promise<unknown>,
  { enabled = true, threshold = 70, maxPull = 110 }: Options = {}
) {
  const pull = useMotionValue(0);
  const [state, setState] = useState<PullState>('idle');
  const onRefreshRef = useRef(onRefresh);
  const refreshingRef = useRef(false);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  });

  useEffect(() => {
    if (!enabled) return;

    let startY = 0;
    let startX = 0;
    let tracking = false;
    let active = false;

    const abort = () => {
      tracking = false;
      active = false;
      setState('idle');
      if (pull.get() > 0) animate(pull, 0, SETTLE);
    };

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || e.touches.length !== 1 || window.scrollY > 0) return;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      tracking = true;
      active = false;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      if (window.scrollY > 0) {
        abort();
        return;
      }

      const dy = e.touches[0].clientY - startY;
      const dx = Math.abs(e.touches[0].clientX - startX);

      if (!active) {
        if (dy < -ACTIVATE_PX || (dx > ACTIVATE_PX && dx >= dy)) {
          tracking = false;
          return;
        }
        if (dy <= ACTIVATE_PX || dy < dx * 1.5) return;
        active = true;
      }

      if (e.cancelable) e.preventDefault();
      const distance = Math.min(Math.max(dy, 0) * RESISTANCE, maxPull);
      pull.set(distance);
      setState(distance >= threshold ? 'ready' : 'idle');
    };

    const onEnd = async () => {
      if (!tracking) return;
      const shouldRefresh = active && pull.get() >= threshold;
      tracking = false;
      active = false;

      if (!shouldRefresh) {
        abort();
        return;
      }

      refreshingRef.current = true;
      setState('refreshing');
      animate(pull, threshold, SETTLE);
      try {
        await onRefreshRef.current();
      } finally {
        refreshingRef.current = false;
        setState('idle');
        animate(pull, 0, SETTLE);
      }
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', abort);

    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', abort);
    };
  }, [enabled, threshold, maxPull, pull]);

  return { pull, state, threshold };
}
