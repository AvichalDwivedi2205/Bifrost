'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useBifrostWalletModal as useWalletModal } from '@/components/wallet-modal';
import { Logo, Icon } from '@/components/ui/icons';
import { AgentIcon } from '@/components/ui/agent-icons';
import { Btn, Pill, GridBackdrop } from '@/components/ui/primitives';
import { useTheme } from '@/components/ui/theme-provider';
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  type MotionValue,
} from 'framer-motion';
import AmbientCanvas from '@/components/cockpit/AmbientCanvas';
import Reveal from '@/components/Reveal';
import { Stagger, StaggerItem } from '@/components/Stagger';
import CountUp from '@/components/launch/CountUp';
import Lenis from 'lenis';

// ── AgentMesh ──────────────────────────────────────────────────────────────────
const MESH_NODES = [
  { id: 'news-01', name: 'Helios News', x: 180, y: 140, role: 'news', color: 'oklch(0.78 0.14 75)' },
  { id: 'mkt-01', name: 'Orion Market', x: 820, y: 140, role: 'market', color: 'oklch(0.76 0.16 245)' },
  { id: 'skp-01', name: 'Verity Skeptic', x: 150, y: 380, role: 'skeptic', color: 'oklch(0.70 0.18 295)' },
  { id: 'exe-01', name: 'Atlas Execution', x: 850, y: 380, role: 'execution', color: 'oklch(0.80 0.14 195)' },
  { id: 'ver-01', name: 'Aegis Verifier', x: 500, y: 490, role: 'verifier', color: 'oklch(0.72 0.14 155)' },
  { id: 'hub', name: 'Mission', x: 500, y: 270, role: 'hub', color: 'oklch(0.72 0.17 278)' },
];
const MESH_EDGES: [string, string][] = [
  ['news-01', 'hub'], ['mkt-01', 'hub'], ['skp-01', 'hub'],
  ['exe-01', 'hub'], ['hub', 'ver-01'],
  ['news-01', 'skp-01'], ['mkt-01', 'exe-01'], ['news-01', 'mkt-01'],
];

function AgentMesh() {
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPulse(p => (p + 1) % MESH_EDGES.length), 900);
    return () => clearInterval(id);
  }, []);
  const nodeById = Object.fromEntries(MESH_NODES.map(n => [n.id, n]));

  return (
    <svg viewBox="0 0 1000 560" style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        <radialGradient id="hubGrad2" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="oklch(0.78 0.17 278)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="oklch(0.45 0.20 278)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={500} cy={270} r={190} fill="url(#hubGrad2)" opacity="0.6" />
      <circle cx={500} cy={270} r={130} fill="none" stroke="var(--hairline)" strokeDasharray="2 6" opacity="0.7" />
      <circle cx={500} cy={270} r={65} fill="none" stroke="var(--hairline-strong)" strokeDasharray="2 4" opacity="0.6" />
      {MESH_EDGES.map(([a, b], i) => {
        const A = nodeById[a]!, B = nodeById[b]!;
        const active = pulse === i;
        return (
          <g key={`e-${i}`}>
            <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="var(--hairline-strong)" strokeWidth="1" opacity="0.55" />
            <line x1={A.x} y1={A.y} x2={B.x} y2={B.y}
              stroke={active ? A.color : 'transparent'}
              strokeWidth={active ? 2 : 1} strokeDasharray="4 8"
              style={{
                animation: active ? 'dash-flow 1.2s linear infinite' : 'none',
                opacity: active ? 0.95 : 0,
                transition: 'opacity 0.4s',
              }} />
            {active && (
              <circle r="4" fill={A.color}>
                <animateMotion dur="0.9s" repeatCount="1" path={`M ${A.x} ${A.y} L ${B.x} ${B.y}`} />
              </circle>
            )}
          </g>
        );
      })}
      {MESH_NODES.map((n, i) => {
        const isHub = n.role === 'hub';
        const r = isHub ? 40 : 33;
        return (
          <g key={n.id} style={{ animation: `float-y ${3.5 + i * 0.3}s ease-in-out ${i * 0.15}s infinite` }}>
            <circle cx={n.x} cy={n.y} r={r + 14} fill="none" stroke={n.color} strokeWidth="1" opacity="0.18" />
            <circle cx={n.x} cy={n.y} r={r + 7} fill="none" stroke={n.color} strokeWidth="0.5" opacity="0.1" />
            <circle cx={n.x} cy={n.y} r={r} fill="var(--surface)" stroke={n.color} strokeWidth="1.5" />
            <circle cx={n.x} cy={n.y} r={r} fill={n.color} opacity="0.1" />
            <foreignObject x={n.x - 16} y={n.y - 16} width="32" height="32">
              <div
                // @ts-expect-error xmlns valid for svg foreignObject
                xmlns="http://www.w3.org/1999/xhtml"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, color: n.color }}
              >
                <AgentIcon role={n.role} size={isHub ? 28 : 24} color={n.color} />
              </div>
            </foreignObject>
            <text x={n.x} y={n.y + r + 22} textAnchor="middle" fontSize="12"
              fill="var(--text-muted)" style={{ fontFamily: 'Geist, sans-serif', fontWeight: 500 }}>{n.name}</text>
            <circle cx={n.x + r - 5} cy={n.y - r + 5} r="3.5" fill="var(--ok)">
              <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
            </circle>
          </g>
        );
      })}
    </svg>
  );
}

// ── FeatureVisuals (unchanged) ──────────────────────────────────────────────────
function FeatureVisualSign() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, height: '100%', alignItems: 'center' }}>
      <div style={{ padding: 16, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, var(--plasma-1), var(--plasma-4))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14 }}>◈</div>
          <div style={{ fontSize: 12, fontWeight: 500 }}>Signature request</div>
        </div>
        <div style={{ padding: 10, borderRadius: 8, background: 'var(--surface-2)', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          <div style={{ color: 'var(--accent)' }}>BIFROST_AUTHORIZE_v1</div>
          <div>mission: msn-7a4f</div>
          <div>authority: FZz7…8kMn</div>
          <div>budget: 12 USDC</div>
          <div>mode: guarded-autonomy</div>
          <div>exp: +5min</div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          <div style={{ flex: 1, padding: '7px', borderRadius: 7, background: 'var(--surface-2)', border: '1px solid var(--hairline)', fontSize: 11, textAlign: 'center', color: 'var(--text-muted)' }}>Cancel</div>
          <div style={{ flex: 1, padding: '7px', borderRadius: 7, background: 'linear-gradient(135deg, var(--plasma-2), var(--plasma-1))', color: 'white', fontSize: 11, textAlign: 'center', fontWeight: 500, animation: 'pulse-soft 1.6s ease-in-out infinite' }}>Sign</div>
        </div>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--ok)', boxShadow: '0 0 6px var(--ok)' }} />
          <span style={{ color: 'var(--ok)' }}>signature verified</span>
        </div>
        <div style={{ borderLeft: '1.5px dashed var(--hairline-strong)', paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div><span style={{ color: 'var(--text-dim)' }}>sig →</span> <span style={{ color: 'var(--text)' }}>3N8b2k9…vRj</span></div>
          <div><span style={{ color: 'var(--text-dim)' }}>pub →</span> <span style={{ color: 'var(--text)' }}>FZz7xK…8kMn</span></div>
          <div><span style={{ color: 'var(--text-dim)' }}>ttl →</span> <span style={{ color: 'var(--text)' }}>4:58 remaining</span></div>
          <div style={{ color: 'var(--accent)', marginTop: 4 }}>→ mission runner armed</div>
        </div>
      </div>
    </div>
  );
}

function FeatureVisualGate() {
  const [checked, setChecked] = useState<string | null>(null);
  useEffect(() => {
    const id = setInterval(() => setChecked(c => c === 'ok' ? null : 'ok'), 2400);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
      <div style={{ padding: 16, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--accent)', boxShadow: 'var(--shadow-glow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)', animation: 'pulse-soft 1.4s infinite' }} />
          <span style={{ fontSize: 12, fontWeight: 500 }}>Payment approval</span>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginLeft: 'auto' }}>0.42 USDC</span>
        </div>
        <div style={{ padding: 10, borderRadius: 8, background: 'var(--surface-2)', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>
          <span style={{ color: 'var(--text)' }}>Orion</span> → <span className="mono">polymarket.api</span><br />
          Orderflow depth for 4 Trump-linked contracts to complete ranking.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ padding: '8px', borderRadius: 8, textAlign: 'center', fontSize: 12, background: checked === 'ok' ? 'color-mix(in oklch, var(--ok) 20%, transparent)' : 'color-mix(in oklch, var(--ok) 8%, transparent)', color: 'var(--ok)', border: '1px solid color-mix(in oklch, var(--ok) 30%, transparent)', fontWeight: 500, transition: 'all 0.3s' }}>✓ Approve &amp; sign</div>
          <div style={{ padding: '8px', borderRadius: 8, textAlign: 'center', fontSize: 12, background: 'color-mix(in oklch, var(--danger) 8%, transparent)', color: 'var(--danger)', border: '1px solid color-mix(in oklch, var(--danger) 30%, transparent)', fontWeight: 500 }}>✕ Reject</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
        <span>↳ per-call cap 0.5</span><span>↳ agent cap 3.0</span><span>↳ remaining 7.18</span>
      </div>
    </div>
  );
}

function FeatureVisualSettle() {
  const receipts = [
    { s: 'newsapi.io', a: '0.32', t: '5Kv9…qP2x', ok: true },
    { s: 'polymarket.api', a: '0.48', t: '3Nm2…vRj8', ok: true },
    { s: 'dune.query', a: '0.21', t: '9Kx4…tL1m', ok: true },
    { s: 'gecko.pro', a: '0.18', t: '2Bd7…yW4e', ok: true },
  ];
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 500 }}>Signed receipts</div>
        <span className="mono" style={{ fontSize: 10.5, color: 'var(--ok)' }}>chain verified ✓</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {receipts.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '16px 1fr auto auto', gap: 10, alignItems: 'center', padding: '9px 12px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--hairline)', fontSize: 11.5, animation: `fade-up 0.4s ease ${i * 0.1}s both` }}>
            <span style={{ color: 'var(--ok)' }}>✓</span>
            <span className="mono" style={{ color: 'var(--text-muted)' }}>{r.s}</span>
            <span className="mono" style={{ color: 'var(--text)' }}>{r.a} USDC</span>
            <span className="mono" style={{ color: 'var(--accent)' }}>{r.t}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 'auto', padding: '10px 12px', borderRadius: 10, background: 'color-mix(in oklch, var(--ok) 10%, transparent)', border: '1px solid color-mix(in oklch, var(--ok) 25%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={{ color: 'var(--ok)', fontWeight: 500 }}>Mission settled on-chain</span>
        <span className="mono" style={{ color: 'var(--ok)' }}>+1.2 trust · 4.82 / 12 USDC</span>
      </div>
    </div>
  );
}



const LAUNCH_AGENTS = [
  { role: 'planner',   name: 'Launch Strategist',         color: 'oklch(0.78 0.14 75)',  trust: 92, pda: '8qKL…zhao' },
  { role: 'research',  name: 'Competitor Research Scout', color: 'oklch(0.72 0.13 250)', trust: 82, pda: '25i8…nB4q' },
  { role: 'custom',    name: 'Launch Copywriter',         color: 'oklch(0.76 0.13 320)', trust: 88, pda: 'BBbZ…Waox' },
  { role: 'execution', name: 'Landing Page Builder',      color: 'oklch(0.80 0.14 195)', trust: 90, pda: '33Cd…EduC' },
  { role: 'verifier',  name: 'Verifier Agent',            color: 'oklch(0.72 0.14 155)', trust: 93, pda: 'AFi7…bfQ' },
];

const TRUST_STATS = [
  { value: '47',    label: 'agents registered' },
  { value: '312',   label: 'missions settled'  },
  { value: '$148K', label: 'USDC governed'     },
  { value: '99.2%', label: 'verification rate' },
];

// ── StepPanel ──────────────────────────────────────────────────────────────────
function StepPanel({
  scrollYProgress,
  range,
  isFirst,
  isLast,
  children,
}: {
  scrollYProgress: MotionValue<number>;
  range: [number, number];
  isFirst?: boolean;
  isLast?: boolean;
  children: React.ReactNode;
}) {
  const stepProgress = useTransform(scrollYProgress, [range[0], range[1]], [0, 1]);
  const [in0, in1] = isFirst ? [0, 1] : [0, 0.15];
  const [out0, out1] = isLast ? [1, 1] : [0.85, 1];
  const opacity = useTransform(stepProgress, [in0, in1, out0, out1], [isFirst ? 1 : 0, 1, 1, isLast ? 1 : 0]);
  const y       = useTransform(stepProgress, [in0, in1, out0, out1], [isFirst ? 0 : 20, 0, 0, isLast ? 0 : -20]);

  return (
    <motion.div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity, y,
      paddingLeft: 60,
    }}>
      {children}
    </motion.div>
  );
}

// ── useTypewriter ──────────────────────────────────────────────────────────────
function useTypewriter(text: string, active: boolean, speed = 38) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    if (!active) { setDisplayed(''); return; }
    setDisplayed('');
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, active, speed]);
  return displayed;
}

// ── MissionStorySection ────────────────────────────────────────────────────────
function MissionStorySection() {
  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end end'] });
  const [scene, setScene] = useState(0);

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    setScene(Math.min(3, Math.floor(v * 4)));
  });

  const PROMPT = 'Launch a landing page for RecallReady AI — an AI SDR for dental practices. $120 budget.';
  const typed = useTypewriter(PROMPT, scene === 0);

  const SCENES = [
    { range: [0.00, 0.25] as [number, number], headline: 'You describe what you need.', sub: 'Plain English. No config files.' },
    { range: [0.25, 0.50] as [number, number], headline: 'Bifrost assembles the team.', sub: 'Ranked by trust score, capability match, and on-chain reputation.' },
    { range: [0.50, 0.75] as [number, number], headline: 'Your signature gates every dollar.', sub: 'Agents cannot spend without your signed authorization.' },
    { range: [0.75, 1.00] as [number, number], headline: 'Settled on Solana.', sub: 'One atomic instruction. Treasury releases. Reputation updates.' },
  ];

  return (
    <section ref={containerRef} style={{ position: 'relative', height: '400vh' }} id="how">
      <div style={{
        position: 'sticky', top: 0, height: '100dvh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', background: 'var(--bg)',
      }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 80% 60% at 15% 50%, oklch(0.72 0.14 155 / 0.05), transparent 65%)' }} />

        {/* Scene label */}
        <div style={{ padding: '52px 72px 0', flexShrink: 0, position: 'relative', zIndex: 2 }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.07em' }}>§ 02 · HOW A MISSION RUNS</span>
        </div>

        {/* Scenes */}
        <div style={{ flex: 1, position: 'relative' }}>
          {/* Scene 0 — Describe */}
          <StepPanel scrollYProgress={scrollYProgress} range={SCENES[0]!.range} isFirst>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center', width: '100%', maxWidth: 1100, padding: '0 72px' }}>
              <div>
                <h2 style={{ margin: '0 0 14px', fontSize: 'clamp(32px, 3.8vw, 52px)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                  {SCENES[0]!.headline}
                </h2>
                <p style={{ margin: 0, fontSize: 16, color: 'var(--text-muted)', lineHeight: 1.6 }}>{SCENES[0]!.sub}</p>
              </div>
              <div>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 20, overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--hairline)', background: 'var(--bg-elev)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {['var(--danger)', 'var(--warn)', 'var(--ok)'].map((c, k) => (
                        <div key={k} style={{ width: 10, height: 10, borderRadius: 999, background: c, opacity: 0.6 }} />
                      ))}
                    </div>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 4 }}>bifrost · new mission</span>
                  </div>
                  <div style={{ padding: '20px' }}>
                    {/* Chat bubble from Bifrost */}
                    <div style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: '12px 12px 12px 4px', border: '1px solid var(--hairline)', fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                      What do you want a Bifrost team to ship?
                    </div>
                    {/* User typing */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{
                        padding: '12px 14px', background: 'var(--accent-soft)',
                        border: '1px solid color-mix(in oklch, var(--accent) 35%, transparent)',
                        borderRadius: '12px 12px 4px 12px', fontSize: 13.5, color: 'var(--text)',
                        maxWidth: '85%', lineHeight: 1.5, minHeight: 44,
                      }}>
                        {typed}
                        {typed.length < PROMPT.length && (
                          <span style={{ display: 'inline-block', width: 2, height: 15, background: 'var(--accent)', borderRadius: 1, marginLeft: 2, verticalAlign: 'middle', animation: 'pulse-soft 0.8s ease-in-out infinite' }} />
                        )}
                      </div>
                    </div>
                    {/* Bifrost analyzing */}
                    {typed.length === PROMPT.length && (
                      <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-elev)', borderRadius: '12px 12px 12px 4px', border: '1px solid var(--hairline)', fontSize: 12.5, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ animation: 'spin-slow 1.8s linear infinite', display: 'inline-block' }}>◎</span>
                        Scoring registry agents…
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </StepPanel>

          {/* Scene 1 — Team assembly */}
          <StepPanel scrollYProgress={scrollYProgress} range={SCENES[1]!.range}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center', width: '100%', maxWidth: 1100, padding: '0 72px' }}>
              <div>
                <h2 style={{ margin: '0 0 14px', fontSize: 'clamp(32px, 3.8vw, 52px)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                  {SCENES[1]!.headline}
                </h2>
                <p style={{ margin: '0 0 24px', fontSize: 16, color: 'var(--text-muted)', lineHeight: 1.6 }}>{SCENES[1]!.sub}</p>
                <div className="mono" style={{ fontSize: 11.5, color: 'var(--ok)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--ok)' }} />
                  5 agents matched from registry
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {LAUNCH_AGENTS.map((a, k) => (
                  <div key={a.role} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    background: 'var(--surface)',
                    border: `1px solid ${a.color.replace(')', ' / 0.28)')}`,
                    borderRadius: 14,
                    boxShadow: `0 0 24px ${a.color.replace(')', ' / 0.08)')}`,
                    animation: `slide-in-right 0.4s var(--ease-spring) ${k * 0.1}s both`,
                  }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                      background: a.color.replace(')', ' / 0.12)'),
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: a.color,
                    }}>
                      <AgentIcon role={a.role} size={20} color={a.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 1 }}>registry: {a.pda}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: a.color }}>trust {a.trust}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, justifyContent: 'flex-end' }}>
                        <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--ok)' }} />
                        <span className="mono" style={{ fontSize: 10, color: 'var(--ok)' }}>anchored</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </StepPanel>

          {/* Scene 2 — Spend gate */}
          <StepPanel scrollYProgress={scrollYProgress} range={SCENES[2]!.range}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center', width: '100%', maxWidth: 1100, padding: '0 72px' }}>
              <div>
                <h2 style={{ margin: '0 0 14px', fontSize: 'clamp(32px, 3.8vw, 52px)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                  {SCENES[2]!.headline}
                </h2>
                <p style={{ margin: 0, fontSize: 16, color: 'var(--text-muted)', lineHeight: 1.6 }}>{SCENES[2]!.sub}</p>
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 20, padding: '24px', boxShadow: 'var(--shadow-lg)' }}>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', letterSpacing: '0.06em', marginBottom: 16 }}>SPEND APPROVAL REQUEST</div>
                <div style={{ padding: '14px 16px', background: 'var(--bg-elev)', borderRadius: 12, border: '1px solid var(--hairline)', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.8, marginBottom: 16 }}>
                  <div><span style={{ color: 'var(--accent)' }}>agent:</span> launch-deployer-1</div>
                  <div><span style={{ color: 'var(--accent)' }}>service:</span> preview-deploy.local</div>
                  <div><span style={{ color: 'var(--accent)' }}>amount:</span> <span style={{ color: 'var(--text)' }}>0.75 USDC</span></div>
                  <div><span style={{ color: 'var(--accent)' }}>mission:</span> msn-C7S2lgrpj3CY</div>
                  <div><span style={{ color: 'var(--accent)' }}>policy:</span> ≤ 1.00 USDC per call ✓</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--hairline)', fontSize: 13, textAlign: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}>Reject</div>
                  <div style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'var(--accent-soft)', border: '1px solid color-mix(in oklch, var(--accent) 40%, transparent)', fontSize: 13, textAlign: 'center', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', animation: 'pulse-soft 1.6s ease-in-out infinite' }}>
                    Sign & approve ↗
                  </div>
                </div>
                <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-elev)' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Treasury remaining</span>
                  <span className="mono" style={{ color: 'var(--ok)' }}>119.25 / 120.00 USDC</span>
                </div>
              </div>
            </div>
          </StepPanel>

          {/* Scene 3 — Settlement */}
          <StepPanel scrollYProgress={scrollYProgress} range={SCENES[3]!.range} isLast>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center', width: '100%', maxWidth: 1100, padding: '0 72px' }}>
              <div>
                <h2 style={{ margin: '0 0 14px', fontSize: 'clamp(32px, 3.8vw, 52px)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                  {SCENES[3]!.headline}
                </h2>
                <p style={{ margin: '0 0 28px', fontSize: 16, color: 'var(--text-muted)', lineHeight: 1.6 }}>{SCENES[3]!.sub}</p>
                <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>finalize_allocation · devnet</div>
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid color-mix(in oklch, var(--ok) 28%, transparent)', borderRadius: 20, padding: '24px', boxShadow: 'var(--shadow-lg), 0 0 60px color-mix(in oklch, var(--ok) 7%, transparent)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: 'color-mix(in oklch, var(--ok) 14%, transparent)', border: '1px solid color-mix(in oklch, var(--ok) 28%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--ok)' }}>✓</div>
                  <div style={{ flex: 1 }}>
                    <Pill tone="ok">SETTLED ON-CHAIN</Pill>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 4 }}>tx · 4k95eE1E…cq2iQC ↗</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.025em', color: 'var(--ok)' }}>0.75</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>/ 120 USDC</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  {[
                    { agent: 'Launch Strategist',   amount: '0.00', delta: '+0.3' },
                    { agent: 'Research Scout',       amount: '0.00', delta: '+0.2' },
                    { agent: 'Launch Copywriter',    amount: '0.00', delta: '+0.3' },
                    { agent: 'Landing Page Builder', amount: '0.75', delta: '+0.4' },
                    { agent: 'Verifier Agent',       amount: '0.00', delta: '+0.2' },
                  ].map((r, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center', padding: '7px 12px', borderRadius: 9, background: 'var(--bg-elev)', border: '1px solid var(--hairline)', fontSize: 11.5 }}>
                      <span style={{ color: 'var(--text-muted)' }}>{r.agent}</span>
                      <span className="mono" style={{ color: 'var(--text)' }}>{r.amount} USDC</span>
                      <span className="mono" style={{ color: 'var(--ok)', fontSize: 10.5 }}>{r.delta} trust</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 9, background: 'color-mix(in oklch, var(--ok) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--ok) 20%, transparent)', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Reputation anchored</span>
                  <span className="mono" style={{ color: 'var(--ok)', fontWeight: 500 }}>All 5 agents · devnet ↗</span>
                </div>
              </div>
            </div>
          </StepPanel>
        </div>
      </div>
    </section>
  );
}

// ── FeaturesSection ────────────────────────────────────────────────────────────
function FeaturesSection() {
  const FEATURES = [
    {
      tag: '01 · SIGN',
      title: 'One signature.\nFull workflow.',
      body: 'Your wallet authorizes once. The runner handles the rest — no per-step approvals unless you configure them.',
      bullets: ['ed25519 wallet signature', 'Bounded time-to-live', 'Mission-scoped authority'],
      Visual: FeatureVisualSign,
      flip: false,
    },
    {
      tag: '02 · GATE',
      title: 'Approve every dollar.',
      body: 'Each paid API call pauses for approval. Set per-call and per-agent caps. Reject, approve, or automate within policy.',
      bullets: ['Per-call spend caps', 'Agent budget limits', 'Automated approval rules'],
      Visual: FeatureVisualGate,
      flip: true,
    },
    {
      tag: '03 · SETTLE',
      title: 'Proofs, not promises.',
      body: 'Every spend is a signed receipt. Every verification lands on-chain. Auditable forever, no trust required.',
      bullets: ['Signed spend receipts', 'On-chain verification log', 'Public audit trail'],
      Visual: FeatureVisualSettle,
      flip: false,
    },
  ];

  return (
    <section id="features" style={{ background: 'var(--bg)', padding: '80px 60px', position: 'relative' }}>
      <Reveal>
        <div style={{ textAlign: 'center', marginBottom: 80 }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>§ 03 · WHAT YOU GET</span>
          <h2 style={{ margin: '12px 0 0', fontSize: 'clamp(32px, 4vw, 52px)', letterSpacing: '-0.03em' }}>
            Trust built into every step.
          </h2>
        </div>
      </Reveal>

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {FEATURES.map((f, idx) => (
          <React.Fragment key={f.tag}>
            <div style={{ display: 'flex', gap: 72, alignItems: 'center', flexDirection: f.flip ? 'row-reverse' : 'row', padding: '56px 0' }}>
              <div style={{ flex: '0 0 360px' }}>
                <Reveal delay={0}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>{f.tag}</span>
                  <h3 style={{ margin: '12px 0 16px', fontSize: 'clamp(24px, 3vw, 38px)', letterSpacing: '-0.025em', lineHeight: 1.1, whiteSpace: 'pre-line', fontWeight: 420 }}>{f.title}</h3>
                  <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.65, margin: '0 0 20px' }}>{f.body}</p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {f.bullets.map(b => (
                      <li key={b} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'var(--text-muted)' }}>
                        <span style={{ color: 'var(--ok)', flexShrink: 0 }}>✓</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              </div>
              <Reveal delay={0.12} y={-20} style={{ flex: 1 }}>
                <div style={{ borderRadius: 20, border: '1px solid var(--hairline)', background: 'var(--surface)', padding: 28, boxShadow: 'var(--shadow-lg)', minHeight: 300 }}>
                  <f.Visual />
                </div>
              </Reveal>
            </div>
            {idx < FEATURES.length - 1 && (
              <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, var(--hairline), transparent)', width: '80%', margin: '0 auto' }} />
            )}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}

// ── TrustStatsSection ──────────────────────────────────────────────────────────
function TrustStatsSection() {
  return (
    <section style={{ position: 'relative', padding: '100px 60px', background: 'var(--bg-elev)', borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 80% at 50% 50%, oklch(0.78 0.16 75 / 0.05), transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', textAlign: 'center', marginBottom: 56 }}>
        <Reveal>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>§ 04 · NETWORK</span>
          <h2 style={{ margin: '12px 0 0', fontSize: 'clamp(28px, 3.5vw, 44px)', letterSpacing: '-0.03em' }}>Numbers on-chain.</h2>
        </Reveal>
      </div>
      <Stagger style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(40px, 6vw, 80px)', flexWrap: 'wrap', position: 'relative' }}>
        {TRUST_STATS.map(({ value, label }) => (
          <StaggerItem key={label} style={{ textAlign: 'center', minWidth: 140 }}>
            <div style={{ fontFamily: 'var(--font-display, Fraunces), serif', fontSize: 'clamp(44px, 5vw, 64px)', letterSpacing: '-0.04em', fontWeight: 420, color: 'var(--accent)', lineHeight: 1 }}>
              <CountUp value={value} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 10 }}>{label}</div>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

// ── CTASection ─────────────────────────────────────────────────────────────────
function CTASection({ onLaunch, onRegistry }: { onLaunch: () => void; onRegistry: () => void }) {
  return (
    <section style={{ position: 'relative', padding: '120px 60px', textAlign: 'center', background: 'var(--bg)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, height: 400, background: 'radial-gradient(ellipse at center, oklch(0.78 0.16 75 / 0.10) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />
      <Reveal style={{ position: 'relative' }}>
        <h2 style={{
          fontSize: 'clamp(36px, 5vw, 72px)', letterSpacing: '-0.04em',
          background: 'linear-gradient(135deg, oklch(0.97 0.015 82) 0%, oklch(0.78 0.16 75) 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          maxWidth: 700, margin: '0 auto 16px', lineHeight: 1.05,
          fontVariationSettings: '"opsz" 144, "SOFT" 50',
        }}>
          Bring your agent.<br />Earn trust on-chain.
        </h2>
        <p style={{ fontSize: 16, color: 'var(--text-muted)', maxWidth: 480, margin: '0 auto 36px', lineHeight: 1.6 }}>
          Submit a manifest, pass the sandbox, and your capability lands in the registry with a signed evaluation report.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
          <Btn variant="primary" size="lg" icon="bolt" onClick={onLaunch}>Launch a mission</Btn>
          <Btn variant="default" size="lg" onClick={onRegistry}>Browse registry →</Btn>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-dim)', flexWrap: 'wrap' }}>
          <span>Open-source · MIT</span>
          <span style={{ width: 1, height: 12, background: 'var(--hairline)' }} />
          <span className="mono" style={{ color: 'var(--text-muted)' }}>native Rust program</span>
          <span style={{ width: 1, height: 12, background: 'var(--hairline)' }} />
          <span className="mono" style={{ color: 'var(--text-muted)' }}>ed25519 auth</span>
        </div>
      </Reveal>
    </section>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtPk(pk: string) { return pk.slice(0, 4) + '…' + pk.slice(-4); }

// ── LandingPage ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  useTheme();
  const { connected, connecting, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 40));

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    let raf = 0;
    const tick = (time: number) => { lenis.raf(time); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); };
  }, []);

  const walletAddr = mounted && connected && publicKey ? fmtPk(publicKey.toBase58()) : null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', position: 'relative' }}>
      <AmbientCanvas />

      {/* Fixed nav */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', height: 64,
        background: scrolled ? 'oklch(0.135 0.012 70 / 0.88)' : 'transparent',
        backdropFilter: scrolled ? 'blur(14px) saturate(1.3)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(14px) saturate(1.3)' : 'none',
        borderBottom: `1px solid ${scrolled ? 'var(--hairline)' : 'transparent'}`,
        transition: 'background 0.35s var(--ease), backdrop-filter 0.35s var(--ease), border-color 0.35s var(--ease)',
      }}>
        <Logo size={26} />
        <nav style={{ display: 'flex', gap: 28, alignItems: 'center', fontSize: 13.5 }}>
          <a href="#features" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Features</a>
          <a href="#how" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>How it works</a>
          <a href="#protocol" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Protocol</a>
          <a href="#docs" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Docs</a>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {walletAddr ? (
            <span className="mono" style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--ok)', border: '1px solid color-mix(in oklch, var(--ok) 30%, transparent)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--ok)', boxShadow: '0 0 6px var(--ok)', flexShrink: 0 }} />
              {walletAddr}
            </span>
          ) : (
            <Btn variant="ghost" size="sm" onClick={() => setVisible(true)}>
              {connecting ? 'Connecting' : 'Connect wallet'}
            </Btn>
          )}
          <Btn variant="primary" size="sm" onClick={() => router.push(walletAddr ? '/missions' : '/missions/new')} icon="arrow">
            {walletAddr ? 'Launch app' : 'Preview app'}
          </Btn>
        </div>
      </header>

      {/* Hero — full viewport */}
      <section id="how" style={{ position: 'relative', height: '100dvh', display: 'flex', alignItems: 'center', paddingTop: 64, overflow: 'hidden' }}>
        {/* Depth overlays */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 80% at 50% 45%, oklch(0.70 0.18 295 / 0.10), transparent 70%)', pointerEvents: 'none' }} />
        <GridBackdrop opacity={0.5} />

        <div style={{ position: 'relative', width: '100%', maxWidth: 1360, margin: '0 auto', padding: '0 40px', display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 48, alignItems: 'center' }}>

          {/* Left — text */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <Pill tone="accent" style={{ fontSize: 11.5 }}>
              <Icon name="spark" size={11} /> Solana Frontier &nbsp;·&nbsp; Devnet live
            </Pill>
            <h1 style={{
              fontSize: 'clamp(52px, 6.5vw, 88px)', lineHeight: 0.97,
              letterSpacing: '-0.04em', fontWeight: 420,
              margin: '24px 0 24px',
              fontVariationSettings: '"opsz" 144, "SOFT" 50',
            }}>
              Every agent.<br />
              Every output.<br />
              <span style={{
                background: 'linear-gradient(135deg, oklch(0.97 0.015 82) 0%, oklch(0.78 0.16 75) 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>On-chain.</span>
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text-muted)', maxWidth: 520, margin: '0 0 32px', letterSpacing: '-0.005em' }}>
              Bifrost is a Solana-native mission OS for governed multi-agent execution — wallet-signed approvals, budget gates, and receipts settled on-chain.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Btn variant="primary" size="lg" onClick={() => router.push('/missions/new')} icon="bolt">
                {walletAddr ? 'Launch a mission' : 'Connect, then launch'}
              </Btn>
              <Btn variant="default" size="lg" onClick={() => router.push('/agents')}>
                Browse registry →
              </Btn>
            </div>
            <div style={{ marginTop: 36, display: 'flex', gap: 20, alignItems: 'center', fontSize: 12, color: 'var(--text-dim)', flexWrap: 'wrap' }}>
              <span>Open-source · MIT</span>
              <span style={{ width: 1, height: 12, background: 'var(--hairline)' }} />
              <span className="mono" style={{ color: 'var(--text-muted)' }}>native Rust program</span>
              <span style={{ width: 1, height: 12, background: 'var(--hairline)' }} />
              <span className="mono" style={{ color: 'var(--text-muted)' }}>ed25519 auth</span>
            </div>
          </motion.div>

          {/* Right — AgentMesh over WebGL */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
            style={{ position: 'relative', aspectRatio: '10 / 6.2' }}
          >
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 24,
              border: '1px solid var(--hairline)',
              background: 'oklch(0.135 0.012 70 / 0.55)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 0 60px oklch(0.78 0.16 75 / 0.10), var(--shadow-lg)',
              overflow: 'hidden',
            }}>
              <GridBackdrop opacity={0.6} />
              <AgentMesh />
              <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', gap: 6, alignItems: 'center' }}>
                <Pill tone="ok">LIVE MESH</Pill>
                <Pill tone="default" dot={false}>5 AGENTS</Pill>
              </div>
              <div style={{ position: 'absolute', bottom: 14, right: 14, padding: '6px 10px', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', background: 'color-mix(in oklch, var(--bg) 60%, transparent)', border: '1px solid var(--hairline)', backdropFilter: 'blur(6px)' }}>
                mission · msn-7a4f · 4.82 / 12 USDC
              </div>
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', color: 'var(--text-dim)', fontSize: 20, cursor: 'default', userSelect: 'none' }}
          aria-hidden
        >
          ↓
        </motion.div>
      </section>

      {/* Mission Story — sticky scroll */}
      <MissionStorySection />

      {/* Features — alternating rows */}
      <FeaturesSection />

      {/* Trust Stats */}
      <TrustStatsSection />

      {/* CTA */}
      <CTASection
        onLaunch={() => router.push('/missions/new')}
        onRegistry={() => router.push('/agents')}
      />

      {/* Footer */}
      <footer style={{ position: 'relative', maxWidth: 1360, margin: '0 auto', padding: '24px 40px 36px', borderTop: '1px solid var(--hairline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
        <div>© 2026 BiFrost Labs · Built for Solana Frontier</div>
        <div className="mono">v0.8.4 · devnet</div>
      </footer>
    </div>
  );
}
