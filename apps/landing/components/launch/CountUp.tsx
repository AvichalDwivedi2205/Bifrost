'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { useInView, useMotionValue, useSpring } from "framer-motion";

interface CountUpProps {
  value: string;
  className?: string;
  durationMs?: number;
}

const NUMERIC_PATTERN = /^([^\d-]*)(-?[\d,]+(?:\.\d+)?)([^\d]*)$/;

interface ParsedNumeric {
  prefix: string;
  raw: string;
  suffix: string;
  target: number;
  decimals: number;
  hasComma: boolean;
}

function parseNumeric(value: string): ParsedNumeric | null {
  const match = NUMERIC_PATTERN.exec(value);
  if (!match) return null;
  const prefix = match[1] ?? "";
  const raw = match[2] ?? "0";
  const suffix = match[3] ?? "";
  const hasDecimal = raw.includes(".");
  const decimals = hasDecimal ? (raw.split(".")[1]?.length ?? 0) : 0;
  return {
    prefix,
    raw,
    suffix,
    target: parseFloat(raw.replace(/,/g, "")),
    decimals,
    hasComma: raw.includes(","),
  };
}

export default function CountUp({ value, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const parsed = useMemo(() => parseNumeric(value), [value]);

  const [display, setDisplay] = useState(value);
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 80, damping: 22, mass: 1 });

  useEffect(() => {
    if (!parsed || !inView) return;
    motionValue.set(parsed.target);
  }, [inView, parsed, motionValue]);

  useEffect(() => {
    if (!parsed) return;
    const { prefix, suffix, decimals, hasComma } = parsed;
    const unsubscribe = spring.on("change", (n) => {
      const safe = Number.isFinite(n) ? n : 0;
      const formatted = hasComma
        ? safe.toLocaleString(undefined, {
            maximumFractionDigits: decimals,
            minimumFractionDigits: decimals,
          })
        : safe.toFixed(decimals);
      setDisplay(`${prefix}${formatted}${suffix}`);
    });
    return () => unsubscribe();
  }, [parsed, spring]);

  if (!parsed) {
    return <span className={className}>{value}</span>;
  }

  return (
    <span ref={ref} className={className} aria-label={value}>
      {display}
    </span>
  );
}
