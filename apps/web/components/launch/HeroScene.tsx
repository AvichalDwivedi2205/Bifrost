'use client';

export default function HeroScene() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: [
          'radial-gradient(ellipse 80% 60% at 65% 40%, #f7d896 0%, transparent 60%)',
          'radial-gradient(ellipse 50% 80% at 80% 70%, #fbe9c0 0%, transparent 55%)',
          'radial-gradient(ellipse 60% 40% at 20% 30%, #f3c97a22 0%, transparent 50%)',
          'linear-gradient(160deg, #fbf6ec 0%, #fdf6e7 50%, #fbe9c0 100%)',
        ].join(', '),
        overflow: 'hidden',
      }}
    >
      {/* Soft animated orbs */}
      <div style={{
        position: 'absolute',
        width: 480,
        height: 480,
        borderRadius: '50%',
        background: 'radial-gradient(circle, #ecae5044 0%, transparent 70%)',
        top: '5%',
        right: '8%',
        animation: 'heroOrb1 8s ease-in-out infinite alternate',
        filter: 'blur(2px)',
      }} />
      <div style={{
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: '50%',
        background: 'radial-gradient(circle, #f3c97a33 0%, transparent 70%)',
        bottom: '15%',
        right: '25%',
        animation: 'heroOrb2 11s ease-in-out infinite alternate',
        filter: 'blur(1px)',
      }} />
      <style>{`
        @keyframes heroOrb1 {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(-30px, 20px) scale(1.08); }
        }
        @keyframes heroOrb2 {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(20px, -25px) scale(1.05); }
        }
      `}</style>
    </div>
  );
}
