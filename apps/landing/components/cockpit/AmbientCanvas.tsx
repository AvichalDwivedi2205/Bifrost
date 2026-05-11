'use client';

export default function AmbientCanvas() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 0,
      pointerEvents: 'none',
      background: [
        'radial-gradient(ellipse 70% 50% at 20% 30%, oklch(0.70 0.18 295 / 0.07), transparent 65%)',
        'radial-gradient(ellipse 50% 60% at 80% 70%, oklch(0.78 0.16 75 / 0.05), transparent 60%)',
        'radial-gradient(ellipse 40% 40% at 50% 10%, oklch(0.72 0.14 155 / 0.04), transparent 55%)',
      ].join(', '),
    }} />
  );
}
