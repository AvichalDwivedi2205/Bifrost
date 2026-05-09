import type { Variants } from 'framer-motion';

export const bubbleEnter: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: [0.2, 0.8, 0.2, 1] },
  },
};

export const bubbleEnterReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18 } },
};

export const staggerParent: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 240, damping: 24 },
  },
};

export const verifierStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.2 } },
};

export const verifierChild: Variants = {
  hidden: { opacity: 0, x: -12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] },
  },
};

export const shakeFail: Variants = {
  initial: { x: 0 },
  shake: {
    x: [-4, 4, -4, 4, 0],
    transition: { duration: 0.4, ease: 'easeInOut' },
  },
};

export const arrowPulse: Variants = {
  initial: { scale: 1 },
  pulse: {
    scale: [1, 1.15, 1],
    transition: { duration: 0.6, repeat: 2, ease: 'easeInOut' },
  },
};

export const modalEnter: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: [0.2, 0.8, 0.2, 1] },
  },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.15 } },
};

export const modalEnterReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

// Spring tunings used with useMotionValue/useSpring elsewhere
export const trustNumberSpring = { stiffness: 80, damping: 18, mass: 1 };
export const treasuryNumberSpring = { stiffness: 60, damping: 18, mass: 1 };
