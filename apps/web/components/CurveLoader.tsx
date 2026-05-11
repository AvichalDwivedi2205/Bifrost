'use client';

import { motion } from "framer-motion";
import { useId, useMemo } from "react";

interface CurveLoaderProps {
  /** Pixel size of the longer dimension. Default 60. */
  size?: number;
  /** Stroke color override. Defaults to the cockpit `--accent` (amber). */
  stroke?: string;
  /** Optional label rendered next to the curve. */
  label?: string;
  /** "wave" sweeps a sine, "orbit" rotates a lemniscate, "pulse" breathes a single arc. */
  variant?: "wave" | "orbit" | "pulse";
}

/**
 * Math-curve-inspired SVG loader. Replaces skeleton spinners on async cockpit states.
 * The path morphs between two waveforms via framer-motion `animate`.
 */
export default function CurveLoader({
  size = 60,
  stroke = "var(--accent, #d99427)",
  label,
  variant = "wave",
}: CurveLoaderProps) {
  const gradientId = useId();
  const height = Math.max(20, Math.round(size * 0.4));
  const paths = useMemo(() => buildPaths(variant, size, height), [variant, size, height]);

  return (
    <span
      role="status"
      aria-label={label ?? "Loading"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        color: "var(--text-muted)",
        fontFamily: "var(--font-mono, ui-monospace), monospace",
        fontSize: 12,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      <svg
        width={size}
        height={height}
        viewBox={`0 0 ${size} ${height}`}
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.0" />
            <stop offset="50%" stopColor={stroke} stopOpacity="1" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <motion.path
          d={paths[0]}
          stroke={`url(#${gradientId})`}
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
          animate={{ d: paths }}
          transition={{
            duration: 1.6,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "loop",
          }}
        />
      </svg>
      {label ? <span>{label}</span> : null}
    </span>
  );
}

function buildPaths(variant: CurveLoaderProps["variant"], width: number, height: number): string[] {
  const samples = 32;
  const cy = height / 2;
  if (variant === "orbit") {
    // Lemniscate-like figure-8 traced inside the box.
    const cx = width / 2;
    const a = Math.min(width / 2.4, height * 1.2);
    const buildOrbit = (phase: number): string => {
      const points: Array<[number, number]> = [];
      for (let i = 0; i <= samples; i++) {
        const t = (i / samples) * Math.PI * 2 + phase;
        const denom = 1 + Math.sin(t) * Math.sin(t);
        const x = cx + (a * Math.cos(t)) / denom;
        const y = cy + (a * Math.sin(t) * Math.cos(t)) / denom;
        points.push([x, y]);
      }
      return points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ");
    };
    return [buildOrbit(0), buildOrbit(Math.PI / 2), buildOrbit(Math.PI), buildOrbit(0)];
  }

  if (variant === "pulse") {
    const buildArc = (radius: number): string => {
      const r = Math.max(3, radius);
      return `M ${width / 2 - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;
    };
    return [buildArc(height * 0.32), buildArc(height * 0.42), buildArc(height * 0.32)];
  }

  // wave: sine morph between two amplitudes / phases
  const amp1 = height * 0.32;
  const amp2 = height * 0.18;
  const buildSine = (amp: number, phase: number, freq: number): string => {
    const points: Array<[number, number]> = [];
    for (let i = 0; i <= samples; i++) {
      const x = (i / samples) * width;
      const y = cy + Math.sin((i / samples) * Math.PI * freq + phase) * amp;
      points.push([x, y]);
    }
    return points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`)
      .join(" ");
  };

  return [
    buildSine(amp1, 0, 4),
    buildSine(amp2, Math.PI / 2, 6),
    buildSine(amp1, Math.PI, 4),
    buildSine(amp2, (3 * Math.PI) / 2, 6),
    buildSine(amp1, 2 * Math.PI, 4),
  ];
}
