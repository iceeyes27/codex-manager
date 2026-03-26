import type { Transition } from "motion/react";

export const MOTION_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const PANEL_TRANSITION: Transition = {
  duration: 0.72,
  ease: MOTION_EASE,
};

export const SPRING_TRANSITION: Transition = {
  type: "spring",
  stiffness: 220,
  damping: 24,
  mass: 0.9,
};

export function revealUp(prefersReducedMotion: boolean, delay = 0) {
  if (prefersReducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: {
        opacity: 1,
        transition: { duration: 0.24, delay },
      },
      exit: {
        opacity: 0,
        transition: { duration: 0.18 },
      },
    };
  }

  return {
    initial: { opacity: 0, y: 18, filter: "blur(16px)" },
    animate: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { ...PANEL_TRANSITION, delay },
    },
    exit: {
      opacity: 0,
      y: -10,
      filter: "blur(10px)",
      transition: { duration: 0.28, ease: MOTION_EASE },
    },
  };
}

export function hoverLift(prefersReducedMotion: boolean) {
  if (prefersReducedMotion) {
    return undefined;
  }

  return {
    y: -4,
    transition: SPRING_TRANSITION,
  };
}
