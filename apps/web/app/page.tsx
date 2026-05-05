'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useBifrostWalletModal as useWalletModal } from '@/components/wallet-modal';
import { Logo, Icon } from '@/components/ui/icons';
import { AgentIcon } from '@/components/ui/agent-icons';
import { Btn, Pill, GridBackdrop, Card } from '@/components/ui/primitives';
import { useTheme } from '@/components/ui/theme-provider';

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
      <circle cx={500} cy={270} r={180} fill="url(#hubGrad2)" opacity="0.55" />
      <circle cx={500} cy={270} r={120} fill="none" stroke="var(--hairline)" strokeDasharray="2 6" opacity="0.7" />
      <circle cx={500} cy={270} r={60} fill="none" stroke="var(--hairline-strong)" strokeDasharray="2 4" opacity="0.6" />
      {MESH_EDGES.map(([a, b], i) => {
        const A = nodeById[a]!, B = nodeById[b]!;
        const active = pulse === i;
        return (
          <g key={`e-${i}`}>
            <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="var(--hairline-strong)" strokeWidth="1" opacity="0.55" />
            <line x1={A.x} y1={A.y} x2={B.x} y2={B.y}
              stroke={active ? A.color : 'transparent'}
              strokeWidth={active ? 1.8 : 1} strokeDasharray="4 8"
              style={{
                animation: active ? 'dash-flow 1.2s linear infinite' : 'none',
                opacity: active ? 0.9 : 0,
                transition: 'opacity 0.4s',
              }} />
            {active && (
              <circle r="3.5" fill={A.color}>
                <animateMotion dur="0.9s" repeatCount="1" path={`M ${A.x} ${A.y} L ${B.x} ${B.y}`} />
              </circle>
            )}
          </g>
        );
      })}
      {MESH_NODES.map((n, i) => {
        const isHub = n.role === 'hub';
        const r = isHub ? 36 : 30;
        return (
          <g key={n.id} style={{ animation: `float-y ${3.5 + i * 0.3}s ease-in-out ${i * 0.15}s infinite` }}>
            <circle cx={n.x} cy={n.y} r={r + 10} fill="none" stroke={n.color} strokeWidth="1" opacity="0.2" />
            <circle cx={n.x} cy={n.y} r={r} fill="var(--surface)" stroke={n.color} strokeWidth="1.5" />
            <circle cx={n.x} cy={n.y} r={r} fill={n.color} opacity="0.1" />
            <foreignObject x={n.x - 14} y={n.y - 14} width="28" height="28">
              <div
                // @ts-expect-error xmlns valid for svg foreignObject
                xmlns="http://www.w3.org/1999/xhtml"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, color: n.color }}
              >
                <AgentIcon role={n.role} size={isHub ? 26 : 22} color={n.color} />
              </div>
            </foreignObject>
            <text x={n.x} y={n.y + r + 22} textAnchor="middle" fontSize="11.5"
              fill="var(--text-muted)" style={{ fontFamily: 'Geist, sans-serif', fontWeight: 500 }}>{n.name}</text>
            <circle cx={n.x + r - 4} cy={n.y - r + 4} r="3" fill="var(--ok)">
              <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
            </circle>
          </g>
        );
      })}
    </svg>
  );
}

// ── DoodleUnderline ────────────────────────────────────────────────────────────
function DoodleUnderline() {
  return (
    <svg viewBox="0 0 420 44" preserveAspectRatio="none" style={{
      position: 'absolute', left: '-4%', bottom: -8, width: '108%', height: 36,
      overflow: 'visible', pointerEvents: 'none',
    }}>
      <defs>
        <linearGradient id="doodleGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--plasma-1)" />
          <stop offset="40%" stopColor="var(--plasma-2)" />
          <stop offset="100%" stopColor="var(--plasma-4)" />
        </linearGradient>
      </defs>
      <path d="M 6 28 C 60 10, 180 6, 316 16 C 360 19, 396 22, 414 26"
        stroke="url(#doodleGrad)" strokeWidth="4.5" strokeLinecap="round" fill="none"
        style={{ strokeDasharray: 900, animation: 'doodle-draw 1.1s cubic-bezier(0.4,0,0.2,1) 0.2s both' }} />
      <path d="M 10 35 C 80 20, 200 15, 318 24 C 352 27, 388 30, 410 34"
        stroke="url(#doodleGrad)" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.75"
        style={{ strokeDasharray: 900, animation: 'doodle-draw 1.2s cubic-bezier(0.4,0,0.2,1) 0.5s both' }} />
      <path d="M 110 40 C 170 30, 250 28, 320 36"
        stroke="url(#doodleGrad)" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.55"
        style={{ strokeDasharray: 400, animation: 'doodle-draw-short 0.8s cubic-bezier(0.4,0,0.2,1) 1s both' }} />
    </svg>
  );
}

// ── HowItWorksStory ────────────────────────────────────────────────────────────
function HowItWorksStory() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep(s => (s + 1) % 5), 2800);
    return () => clearInterval(id);
  }, []);

  const StepFrame = ({ i, label, children }: { i: number; label: string; children: React.ReactNode }) => (
    <div style={{
      position: 'relative', borderRadius: 14,
      border: `1px solid ${step === i ? 'var(--accent)' : 'var(--hairline)'}`,
      background: step === i ? 'color-mix(in oklch, var(--accent-soft) 40%, var(--surface))' : 'var(--surface)',
      overflow: 'hidden', transition: 'all 0.5s var(--ease)',
      transform: step === i ? 'translateY(-4px)' : 'translateY(0)',
      boxShadow: step === i ? 'var(--shadow-md)' : 'var(--shadow-sm)',
    }}>
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid var(--hairline)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span className="mono" style={{ fontSize: 10.5, color: step === i ? 'var(--accent)' : 'var(--text-dim)', letterSpacing: '0.06em' }}>
          STEP 0{i + 1}
        </span>
        <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ padding: '14px', height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, position: 'relative' }}>
      <svg style={{ position: 'absolute', top: 72, left: 0, right: 0, width: '100%', height: 20, pointerEvents: 'none', zIndex: 0 }}
        viewBox="0 0 1000 20" preserveAspectRatio="none">
        <path d="M 100 10 Q 300 0, 500 10 T 900 10" stroke="var(--hairline-strong)"
          strokeWidth="1.2" strokeDasharray="3 4" fill="none" />
      </svg>

      {/* 01 — Sign */}
      <StepFrame i={0} label="Sign">
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            padding: '8px 10px', borderRadius: 8, background: 'var(--surface-2)',
            border: '1px solid var(--hairline)', fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--text-muted)',
          }}>
            <div style={{ color: 'var(--text-dim)', marginBottom: 3 }}># bifrost.authorize</div>
            <div>mission: msn-7a4f</div>
            <div>budget: 12 USDC</div>
            <div>exp: 2026-04-24T12:34Z</div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
            fontSize: 10.5, color: 'var(--accent)', fontWeight: 500,
          }}>
            <span style={{
              width: 14, height: 14, borderRadius: 4,
              background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 10,
            }}>✓</span>
            ed25519 signed
          </div>
        </div>
      </StepFrame>

      {/* 02 — Propose */}
      <StepFrame i={1} label="Propose">
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {(['news', 'market', 'skeptic', 'execution', 'verifier'] as const).map((r, k) => {
            const colors = ['oklch(0.78 0.14 75)', 'oklch(0.76 0.16 245)', 'oklch(0.70 0.18 295)', 'oklch(0.80 0.14 195)', 'oklch(0.72 0.14 155)'];
            const c = colors[k] ?? 'var(--accent)';
            return (
              <div key={r} style={{
                width: 34, height: 34, borderRadius: 9,
                background: c.replace(')', ' / 0.14)'), color: c,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${c.replace(')', ' / 0.3)')}`,
                animation: step === 1 ? `float-y 2s ease-in-out ${k * 0.1}s infinite` : 'none',
              }}>
                <AgentIcon role={r} size={18} color={c} />
              </div>
            );
          })}
        </div>
      </StepFrame>

      {/* 03 — Approve */}
      <StepFrame i={2} label="Approve">
        <div style={{ position: 'relative', width: 90, height: 90 }}>
          <svg viewBox="0 0 90 90" width="90" height="90">
            <circle cx="45" cy="45" r="38" fill="none" stroke="var(--hairline-strong)" strokeWidth="2" />
            <circle cx="45" cy="45" r="38" fill="none" stroke="var(--accent)" strokeWidth="2"
              strokeDasharray={2 * Math.PI * 38} strokeDashoffset={step >= 2 ? 0 : 2 * Math.PI * 38}
              transform="rotate(-90 45 45)" strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1.2s var(--ease)' }} />
            <path d="M 32 45 L 42 55 L 60 36" fill="none" stroke="var(--accent)"
              strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="40" strokeDashoffset={step >= 2 ? 0 : 40}
              style={{ transition: 'stroke-dashoffset 0.6s 0.8s var(--ease)' }} />
          </svg>
        </div>
      </StepFrame>

      {/* 04 — Execute */}
      <StepFrame i={3} label="Execute">
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {([
            ['news', 100, 'oklch(0.78 0.14 75)'],
            ['market', 100, 'oklch(0.76 0.16 245)'],
            ['skeptic', 65, 'oklch(0.70 0.18 295)'],
            ['execution', 20, 'oklch(0.80 0.14 195)'],
          ] as [string, number, string][]).map(([r, pct, c]) => (
            <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 54, fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{r}</span>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--surface-2)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: c, borderRadius: 2,
                  width: step >= 3 ? `${pct}%` : 0,
                  transition: `width 1.2s var(--ease) ${0.1 * (pct / 100)}s`,
                }} />
              </div>
            </div>
          ))}
        </div>
      </StepFrame>

      {/* 05 — Settle */}
      <StepFrame i={4} label="Settle">
        <div style={{ textAlign: 'center' }}>
          <div className="mono" style={{
            padding: '6px 10px', borderRadius: 7,
            background: 'color-mix(in oklch, var(--ok) 12%, transparent)',
            color: 'var(--ok)', fontSize: 11, marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--ok)', boxShadow: '0 0 6px var(--ok)' }} />
            SETTLED
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>tx · 5Kv9…qP2x</div>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>+1.2 trust</div>
        </div>
      </StepFrame>
    </div>
  );
}

// ── FeatureVisuals ─────────────────────────────────────────────────────────────
function FeatureVisualSign() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, height: '100%', alignItems: 'center' }}>
      <div style={{
        padding: 16, borderRadius: 14,
        background: 'var(--surface)', border: '1px solid var(--hairline)',
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--plasma-1), var(--plasma-4))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14,
          }}>◈</div>
          <div style={{ fontSize: 12, fontWeight: 500 }}>Signature request</div>
        </div>
        <div style={{
          padding: 10, borderRadius: 8, background: 'var(--surface-2)',
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.7,
        }}>
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
      <div style={{
        padding: 16, borderRadius: 14,
        background: 'var(--surface)', border: '1px solid var(--accent)', boxShadow: 'var(--shadow-glow)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)', animation: 'pulse-soft 1.4s infinite' }} />
          <span style={{ fontSize: 12, fontWeight: 500 }}>Payment approval</span>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginLeft: 'auto' }}>0.42 USDC</span>
        </div>
        <div style={{
          padding: 10, borderRadius: 8, background: 'var(--surface-2)', fontSize: 11.5,
          color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12,
        }}>
          <span style={{ color: 'var(--text)' }}>Orion</span> → <span className="mono">polymarket.api</span><br />
          Orderflow depth for 4 Trump-linked contracts to complete ranking.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{
            padding: '8px', borderRadius: 8, textAlign: 'center', fontSize: 12,
            background: checked === 'ok' ? 'color-mix(in oklch, var(--ok) 20%, transparent)' : 'color-mix(in oklch, var(--ok) 8%, transparent)',
            color: 'var(--ok)', border: '1px solid color-mix(in oklch, var(--ok) 30%, transparent)',
            fontWeight: 500, transition: 'all 0.3s',
          }}>✓ Approve &amp; sign</div>
          <div style={{
            padding: '8px', borderRadius: 8, textAlign: 'center', fontSize: 12,
            background: 'color-mix(in oklch, var(--danger) 8%, transparent)',
            color: 'var(--danger)', border: '1px solid color-mix(in oklch, var(--danger) 30%, transparent)',
            fontWeight: 500,
          }}>✕ Reject</div>
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
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '16px 1fr auto auto', gap: 10, alignItems: 'center',
            padding: '9px 12px', borderRadius: 9, background: 'var(--surface)',
            border: '1px solid var(--hairline)', fontSize: 11.5,
            animation: `fade-up 0.4s ease ${i * 0.1}s both`,
          }}>
            <span style={{ color: 'var(--ok)' }}>✓</span>
            <span className="mono" style={{ color: 'var(--text-muted)' }}>{r.s}</span>
            <span className="mono" style={{ color: 'var(--text)' }}>{r.a} USDC</span>
            <span className="mono" style={{ color: 'var(--accent)' }}>{r.t}</span>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 'auto', padding: '10px 12px', borderRadius: 10,
        background: 'color-mix(in oklch, var(--ok) 10%, transparent)',
        border: '1px solid color-mix(in oklch, var(--ok) 25%, transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12,
      }}>
        <span style={{ color: 'var(--ok)', fontWeight: 500 }}>Mission settled on-chain</span>
        <span className="mono" style={{ color: 'var(--ok)' }}>+1.2 trust · 4.82 / 12 USDC</span>
      </div>
    </div>
  );
}

// ── FeatureShowcase ────────────────────────────────────────────────────────────
function FeatureShowcase() {
  const [tab, setTab] = useState(0);
  const [paused, setPaused] = useState(false);
  const tabs = [
    { tag: 'Sign', title: 'One signature. Full workflow.', body: 'Your wallet authorizes once. The runner handles the rest.' },
    { tag: 'Gate', title: 'Approve every dollar.', body: 'Each paid call pauses. Reject it, approve it, or automate it within caps.' },
    { tag: 'Settle', title: 'Proofs, not promises.', body: 'Every spend is a signed receipt. Every verification lands on-chain.' },
  ];
  const DWELL = 4200;

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setTab(t => (t + 1) % tabs.length), DWELL);
    return () => clearInterval(id);
  }, [paused, tabs.length]);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        display: 'grid', gridTemplateColumns: '320px 1fr', gap: 18,
        padding: 20, borderRadius: 18,
        background: 'var(--surface)', border: '1px solid var(--hairline)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tabs.map((t, i) => {
          const active = tab === i;
          return (
            <button key={t.tag} onClick={() => setTab(i)} style={{
              position: 'relative', overflow: 'hidden',
              textAlign: 'left', padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
              background: active ? 'color-mix(in oklch, var(--accent-soft) 50%, var(--surface-2))' : 'transparent',
              border: `1px solid ${active ? 'var(--accent)' : 'var(--hairline)'}`,
              color: 'var(--text)', transition: 'all 0.25s',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="mono" style={{ fontSize: 10.5, color: active ? 'var(--accent)' : 'var(--text-dim)', letterSpacing: '0.06em' }}>
                  0{i + 1} · {t.tag.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 500, letterSpacing: '-0.015em' }}>{t.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>{t.body}</div>
              {active && !paused && (
                <span key={tab} style={{
                  position: 'absolute', left: 0, bottom: 0, height: 2,
                  background: 'linear-gradient(90deg, var(--plasma-1), var(--plasma-2), var(--plasma-4))',
                  width: '100%', transformOrigin: 'left center',
                  animation: `feature-progress ${DWELL}ms linear forwards`,
                }} />
              )}
            </button>
          );
        })}
      </div>
      <div style={{
        position: 'relative', borderRadius: 14, overflow: 'hidden',
        background: 'var(--bg-elev)', border: '1px solid var(--hairline)',
        minHeight: 340, padding: 22,
      }}>
        {tab === 0 && <FeatureVisualSign />}
        {tab === 1 && <FeatureVisualGate />}
        {tab === 2 && <FeatureVisualSettle />}
      </div>
    </div>
  );
}

// ── Pillars ────────────────────────────────────────────────────────────────────
function Pillars() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
      <Card pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '18px 18px 14px' }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4, letterSpacing: '-0.015em' }}>Capability-first registry</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>One agent, many certified skills.</div>
        </div>
        <div style={{ padding: '4px 18px 18px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {([['news.synthesize', 96], ['news.timeline', 94], ['news.source.rank', 91]] as [string, number][]).map(([n, s]) => (
            <div key={n} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', borderRadius: 7, background: 'var(--surface-2)',
              border: '1px solid var(--hairline)', fontSize: 10.5,
            }}>
              <span style={{ color: 'var(--ok)' }}>✓</span>
              <span className="mono" style={{ flex: 1, color: 'var(--text)' }}>{n}</span>
              <span className="mono" style={{ color: 'var(--ok)' }}>{s}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '18px 18px 14px' }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4, letterSpacing: '-0.015em' }}>Portable reputation</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>Trust travels with the agent.</div>
        </div>
        <div style={{ padding: '4px 18px 20px' }}>
          <svg viewBox="0 0 200 80" style={{ width: '100%', height: 80 }}>
            <defs>
              <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--plasma-2)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="var(--plasma-2)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M 0 60 L 20 55 L 40 45 L 60 48 L 80 35 L 100 38 L 120 28 L 140 22 L 160 18 L 180 12 L 200 8 L 200 80 L 0 80 Z"
              fill="url(#trendGrad)" />
            <path d="M 0 60 L 20 55 L 40 45 L 60 48 L 80 35 L 100 38 L 120 28 L 140 22 L 160 18 L 180 12 L 200 8"
              stroke="var(--plasma-2)" strokeWidth="1.8" fill="none" />
            <circle cx="200" cy="8" r="3" fill="var(--plasma-2)" />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10.5, color: 'var(--text-dim)' }}>
            <span>30d</span>
            <span className="mono" style={{ color: 'var(--ok)' }}>+8.2 trust</span>
          </div>
        </div>
      </Card>

      <Card pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '18px 18px 14px' }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4, letterSpacing: '-0.015em' }}>Model-agnostic</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>Route across providers with fallback.</div>
        </div>
        <div style={{ padding: '4px 18px 20px' }}>
          <svg viewBox="0 0 200 90" style={{ width: '100%', height: 90 }}>
            <circle cx="40" cy="45" r="12" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1" />
            <text x="40" y="49" textAnchor="middle" fontSize="9" fontFamily="Geist Mono" fill="var(--accent)">rtr</text>
            {([
              { y: 12, label: 'primary', c: 'var(--ok)' },
              { y: 45, label: 'fallback', c: 'var(--warn)' },
              { y: 78, label: 'mock', c: 'var(--text-dim)' },
            ]).map((d, i) => (
              <g key={i}>
                <path d={`M 52 45 Q 90 45, 130 ${d.y + 8}`} stroke={d.c} strokeWidth="1.2" fill="none" strokeDasharray={i === 0 ? '0' : '3 3'} />
                <rect x="130" y={d.y} width="60" height="16" rx="4" fill="var(--surface-2)" stroke="var(--hairline)" />
                <circle cx="140" cy={d.y + 8} r="2.5" fill={d.c} />
                <text x="148" y={d.y + 11} fontSize="9" fontFamily="Geist" fill="var(--text-muted)">{d.label}</text>
              </g>
            ))}
          </svg>
        </div>
      </Card>

      <Card pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '18px 18px 14px' }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4, letterSpacing: '-0.015em' }}>Native Rust enforcement</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>Primitives live in the Solana program.</div>
        </div>
        <div style={{ padding: '4px 18px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
          {['Mission', 'Allocation', 'SpendRequest', 'Receipt', 'Verification', 'Reputation'].map(n => (
            <div key={n} className="mono" style={{
              fontSize: 9.5, padding: '5px 8px', borderRadius: 5,
              background: 'var(--surface-2)', color: 'var(--text-muted)',
              border: '1px solid var(--hairline)', textAlign: 'center',
            }}>{n}</div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function fmtPk(pk: string) {
  return pk.slice(0, 4) + '…' + pk.slice(-4);
}

// ── LandingPage ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const { connected, connecting, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const walletAddr = connected && publicKey ? fmtPk(publicKey.toBase58()) : null;

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)',
      position: 'relative', overflow: 'hidden',
    }}>
      <GridBackdrop />
      <div style={{
        position: 'absolute', top: -120, left: '40%', width: 600, height: 600,
        background: 'radial-gradient(circle, oklch(0.70 0.18 295 / 0.25), transparent 60%)',
        pointerEvents: 'none', filter: 'blur(40px)',
      }} />
      <div style={{
        position: 'absolute', bottom: -200, right: -100, width: 500, height: 500,
        background: 'radial-gradient(circle, oklch(0.78 0.16 180 / 0.18), transparent 60%)',
        pointerEvents: 'none', filter: 'blur(40px)',
      }} />

      {/* Header */}
      <header style={{
        position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '22px 40px', maxWidth: 1360, margin: '0 auto',
      }}>
        <Logo size={26} />
        <nav style={{ display: 'flex', gap: 28, alignItems: 'center', fontSize: 13.5 }}>
          <a href="#features" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Features</a>
          <a href="#how" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>How it works</a>
          <a href="#protocol" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Protocol</a>
          <a href="#docs" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Docs</a>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={toggle} style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'var(--surface)', border: '1px solid var(--hairline)',
            color: 'var(--text-muted)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={mounted && theme === 'light' ? 'moon' : 'sun'} size={14} />
          </button>
          {walletAddr ? (
            <span className="mono" style={{
              fontSize: 11.5, padding: '4px 10px', borderRadius: 8,
              background: 'var(--surface-2)', color: 'var(--ok)',
              border: '1px solid color-mix(in oklch, var(--ok) 30%, transparent)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
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

      {/* Hero */}
      <section style={{
        position: 'relative', maxWidth: 1360, margin: '0 auto',
        padding: '32px 40px 60px', display: 'grid',
        gridTemplateColumns: '1.05fr 1.15fr', gap: 48, alignItems: 'center',
      }}>
        <div style={{ animation: 'fade-up 0.8s var(--ease)' }}>
          <Pill tone="accent" style={{ fontSize: 11.5 }}>
            <Icon name="spark" size={11} /> Solana Frontier &nbsp;·&nbsp; Devnet live
          </Pill>
          <h1 style={{
            fontSize: 'clamp(44px, 5vw, 68px)', lineHeight: 1.02, letterSpacing: '-0.035em',
            fontWeight: 500, margin: '22px 0 22px', overflow: 'visible',
          }}>
            The mission OS for<br />
            governed agent{' '}
            <span style={{ position: 'relative', display: 'inline-block', paddingBottom: 18, overflow: 'visible' }}>
              <span style={{
                background: 'linear-gradient(110deg, var(--plasma-1), var(--plasma-2) 40%, var(--plasma-4))',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>swarms</span>
              <DoodleUnderline />
            </span>
            <span style={{ color: 'var(--text)' }}>.</span>
          </h1>
          <p style={{
            fontSize: 17, lineHeight: 1.6, color: 'var(--text-muted)',
            maxWidth: 540, margin: '18px 0 32px', letterSpacing: '-0.005em',
          }}>
            Spin up a team of agents, give them a budget, and watch them work — with
            wallet-signed approvals at every paid step and receipts settled on Solana.
            No babysitting. No surprise bills.
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Btn variant="primary" size="lg" onClick={() => router.push('/missions/new')} icon="bolt">
              {walletAddr ? 'Launch a mission' : 'Connect, then launch'}
            </Btn>
            <Btn variant="default" size="lg" onClick={() => router.push('/agents')}>
              Browse registry →
            </Btn>
          </div>
          <div style={{
            marginTop: 36, display: 'flex', gap: 20, alignItems: 'center',
            fontSize: 12, color: 'var(--text-dim)', flexWrap: 'wrap',
          }}>
            <span>Open-source · MIT</span>
            <span style={{ width: 1, height: 12, background: 'var(--hairline)' }} />
            <span className="mono" style={{ color: 'var(--text-muted)' }}>native Rust program</span>
            <span style={{ width: 1, height: 12, background: 'var(--hairline)' }} />
            <span className="mono" style={{ color: 'var(--text-muted)' }}>ed25519 auth</span>
          </div>
        </div>

        {/* Mesh viz */}
        <div style={{ position: 'relative', aspectRatio: '10 / 6.2', animation: 'fade-up 1s var(--ease)' }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 24,
            border: '1px solid var(--hairline)', background: 'var(--bg-elev)',
            boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
          }}>
            <GridBackdrop opacity={0.6} />
            <AgentMesh />
            <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', gap: 6, alignItems: 'center' }}>
              <Pill tone="ok">LIVE MESH</Pill>
              <Pill tone="default" dot={false}>5 AGENTS</Pill>
            </div>
            <div style={{
              position: 'absolute', bottom: 14, right: 14,
              padding: '6px 10px', borderRadius: 8, fontFamily: 'var(--font-mono)',
              fontSize: 11, color: 'var(--text-dim)',
              background: 'color-mix(in oklch, var(--bg) 60%, transparent)',
              border: '1px solid var(--hairline)', backdropFilter: 'blur(6px)',
            }}>mission · msn-7a4f · 4.82 / 12 USDC</div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" style={{
        position: 'relative', maxWidth: 1360, margin: '0 auto', padding: '20px 40px 40px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 22 }}>
          <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>§ 01</span>
          <h3 style={{ margin: 0, fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em' }}>How a mission runs</h3>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 'auto' }}>live demo — loops automatically</span>
        </div>
        <HowItWorksStory />
      </section>

      {/* Feature showcase */}
      <section id="features" style={{
        position: 'relative', maxWidth: 1360, margin: '0 auto', padding: '30px 40px 40px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 22 }}>
          <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>§ 02</span>
          <h3 style={{ margin: 0, fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em' }}>What you get out of the box</h3>
        </div>
        <FeatureShowcase />
      </section>

      {/* Pillars */}
      <section style={{
        position: 'relative', maxWidth: 1360, margin: '0 auto', padding: '10px 40px 60px',
      }}>
        <Pillars />
      </section>

      {/* CTA */}
      <section style={{
        position: 'relative', maxWidth: 1360, margin: '0 auto 60px', padding: '0 40px',
      }}>
        <div style={{
          borderRadius: 20, border: '1px solid var(--hairline)', padding: '40px 44px',
          background: 'linear-gradient(110deg, var(--surface), color-mix(in oklch, var(--accent-soft) 80%, var(--surface)))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
          boxShadow: 'var(--shadow-md)', position: 'relative', overflow: 'hidden',
        }}>
          <div>
            <h4 style={{ margin: 0, fontSize: 26, fontWeight: 500, letterSpacing: '-0.025em' }}>
              Bring your agent. Earn trust on-chain.
            </h4>
            <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--text-muted)', maxWidth: 560 }}>
              Submit a manifest, pass the sandbox, and your capability lands in the registry with a signed evaluation report.
            </p>
          </div>
          <Btn variant="primary" size="lg" icon="arrow" onClick={() => router.push('/agents')}>Open registry</Btn>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        position: 'relative', maxWidth: 1360, margin: '0 auto',
        padding: '24px 40px 36px', borderTop: '1px solid var(--hairline)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 12, color: 'var(--text-dim)',
      }}>
        <div>© 2026 BiFrost Labs · Built for Solana Frontier</div>
        <div className="mono">v0.8.4 · devnet</div>
      </footer>
    </div>
  );
}
