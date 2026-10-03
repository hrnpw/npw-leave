import type { Variants } from 'framer-motion';

// direction: 1 = forward (enter from right), -1 = backward (enter from left)
export const stepVariants: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 20 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction * -20 }),
};
