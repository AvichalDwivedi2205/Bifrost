'use client';

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";

const ENTER = { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] as const };

export default function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [reduced, setReduced] = useState(false);
  const firstMountRef = useRef(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    firstMountRef.current = false;
  }, []);

  if (reduced) {
    return <>{children}</>;
  }

  return (
    <motion.div
      key={pathname}
      initial={firstMountRef.current ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={ENTER}
    >
      {children}
    </motion.div>
  );
}
