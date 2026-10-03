'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * ดึงหน้าจอลงที่ด้านบนสุดเพื่อรีเฟรช (มือถือ)
 * คืน pullDistance ไว้วาด indicator และ isRefreshing ตอนกำลังโหลด
 */
export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const distanceRef = useRef(0);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startY === 0 || window.scrollY > 0) return;
      const distance = e.touches[0].clientY - startY;
      if (distance > 0 && distance < 100) {
        distanceRef.current = distance;
        setPullDistance(distance);
      }
    };

    const handleTouchEnd = async () => {
      if (distanceRef.current > 60) {
        setIsRefreshing(true);
        await refreshRef.current();
        setIsRefreshing(false);
      }
      startY = 0;
      distanceRef.current = 0;
      setPullDistance(0);
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  return { pullDistance, isRefreshing };
}
