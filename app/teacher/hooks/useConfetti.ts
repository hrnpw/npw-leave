import { useState, useEffect } from 'react';

export function useConfetti() {
  const [isActive, setIsActive] = useState(false);

  const trigger = () => {
    setIsActive(true);
  };

  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => {
        setIsActive(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  return [isActive, trigger] as const;
}
