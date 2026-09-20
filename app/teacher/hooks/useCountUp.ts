import { useState, useEffect } from 'react';

export function useCountUp(target: number, duration: number = 800, delay: number = 0) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const startTime = Date.now() + delay;
    const endTime = startTime + duration;

    const timer = setInterval(() => {
      const now = Date.now();
      if (now < startTime) return;

      const progress = Math.min((now - startTime) / duration, 1);
      const easeOutQuad = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * easeOutQuad));

      if (now >= endTime) {
        setCount(target);
        clearInterval(timer);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [target, duration, delay]);

  return count;
}
