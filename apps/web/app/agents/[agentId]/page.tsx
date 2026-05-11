'use client';
import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { demoRegistry } from '@bifrost/shared';
import { Shell } from '@/components/ui/shell';
import { Card, Btn, Pill } from '@/components/ui/primitives';
import { AgentIcon } from '@/components/ui/agent-icons';
import { Icon } from '@/components/ui/icons';
import TxLink from '@/components/solana/TxLink';

const ROLE_COLORS: Record<string, string> = {
  coordinator: 'oklch(0.78 0.16 180)',
  news: 'oklch(0.78 0.14 75)',
  market: 'oklch(0.76 0.16 245)',
  skeptic: 'oklch(0.70 0.18 295)',
  research: 'oklch(0.72 0.13 250)',
  wallet_intelligence: 'oklch(0.70 0.13 210)',
  risk: 'oklch(0.65 0.20 25)',
  compliance: 'oklch(0.72 0.12 145)',
  execution: 'oklch(0.80 0.14 195)',
  verifier: 'oklch(0.72 0.14 155)',
  planner: 'oklch(0.78 0.14 75)',
  custom: 'oklch(0.76 0.13 320)',
};

const ROLE_REP_HISTORY: Record<string, Array<{ m: string; d: string; tone: string; t: string }>> = {
  planner:    [
    { m: 'Q3 Outbound Launch — RecallReady AI', d: '+3 pts', tone: 'ok', t: 'today' },
    { m: 'Lead Enrichment Sweep · ICP Cohort 12', d: '+2 pts', tone: 'ok', t: '2d ago' },
    { m: 'API Docs Refresh · payments-service', d: '+1 pt', tone: 'ok', t: '4d ago' },
    { m: 'PR Review Sprint · billing-service v2.4', d: '−1 pt', tone: 'warn', t: '6d ago' },
    { m: 'SOC 2 Quarterly Evidence Sweep', d: '+2 pts', tone: 'ok', t: '8d ago' },
  ],
  custom:     [
    { m: 'Q3 Outbound Launch — RecallReady AI', d: '+2 pts', tone: 'ok', t: 'today' },
    { m: 'Lead Enrichment Sweep · ICP Cohort 12', d: '+3 pts', tone: 'ok', t: '3d ago' },
    { m: 'Vendor Invoice Batch Audit', d: '0', tone: 'default', t: '5d ago' },
    { m: 'SOC 2 Quarterly Evidence Sweep', d: '+1 pt', tone: 'ok', t: '7d ago' },
    { m: 'PR Review Sprint · billing-service v2.4', d: '+2 pts', tone: 'ok', t: '9d ago' },
  ],
  research:   [
    { m: 'Lead Enrichment Sweep · ICP Cohort 12', d: '+3 pts', tone: 'ok', t: 'today' },
    { m: 'Q3 Outbound Launch — RecallReady AI', d: '+2 pts', tone: 'ok', t: '2d ago' },
    { m: 'Vendor Invoice Batch Audit · 18 invoices', d: '+1 pt', tone: 'ok', t: '4d ago' },
    { m: 'API Docs Refresh · payments-service', d: '0', tone: 'default', t: '6d ago' },
    { m: 'SOC 2 Quarterly Evidence Sweep', d: '+2 pts', tone: 'ok', t: '9d ago' },
  ],
  verifier:   [
    { m: 'Q3 Outbound Launch — RecallReady AI', d: '+2 pts', tone: 'ok', t: 'today' },
    { m: 'Vendor Invoice Batch Audit · 18 invoices', d: '+3 pts', tone: 'ok', t: '2d ago' },
    { m: 'PR Review Sprint · billing-service v2.4', d: '−1 pt', tone: 'warn', t: '4d ago' },
    { m: 'SOC 2 Quarterly Evidence Sweep', d: '+2 pts', tone: 'ok', t: '6d ago' },
    { m: 'API Docs Refresh · payments-service', d: '+1 pt', tone: 'ok', t: '8d ago' },
  ],
  compliance: [
    { m: 'SOC 2 Quarterly Evidence Sweep', d: '+3 pts', tone: 'ok', t: 'today' },
    { m: 'Vendor Invoice Batch Audit · 18 invoices', d: '+2 pts', tone: 'ok', t: '3d ago' },
    { m: 'PR Review Sprint · billing-service v2.4', d: '+1 pt', tone: 'ok', t: '5d ago' },
    { m: 'Lead Enrichment Sweep · ICP Cohort 12', d: '0', tone: 'default', t: '8d ago' },
    { m: 'API Docs Refresh · payments-service', d: '+2 pts', tone: 'ok', t: '10d ago' },
  ],
  execution:  [
    { m: 'API Docs Refresh · payments-service', d: '+2 pts', tone: 'ok', t: 'today' },
    { m: 'PR Review Sprint · billing-service v2.4', d: '+3 pts', tone: 'ok', t: '2d ago' },
    { m: 'Q3 Outbound Launch — RecallReady AI', d: '−1 pt', tone: 'warn', t: '4d ago' },
    { m: 'Vendor Invoice Batch Audit · 18 invoices', d: '+2 pts', tone: 'ok', t: '6d ago' },
    { m: 'SOC 2 Quarterly Evidence Sweep', d: '+1 pt', tone: 'ok', t: '9d ago' },
  ],
};

// ── Radar chart ───────────────────────────────────────────────────────────────

interface RadarDim {
  label: string;
  value: number; // 0–100
}

function RadarChart({ dims }: { dims: RadarDim[] }) {
  const cx = 100;
  const cy = 100;
  const r = 76; // outer radius for 100%
  const rings = [0.2, 0.4, 0.6, 0.8, 1.0];
  const n = dims.length;

  // Angle for each axis: start at top (-90°), go clockwise
  const angleOf = (i: number) => ((i * 2 * Math.PI) / n) - Math.PI / 2;

  // Polygon corners for a ring at scale s
  const ringPoints = (s: number) =>
    dims
      .map((_, i) => {
        const a = angleOf(i);
        return `${cx + r * s * Math.cos(a)},${cy + r * s * Math.sin(a)}`;
      })
      .join(' ');

  // Data polygon
  const dataPoints = dims
    .map((d, i) => {
      const a = angleOf(i);
      const pct = Math.max(0, Math.min(100, d.value)) / 100;
      return `${cx + r * pct * Math.cos(a)},${cy + r * pct * Math.sin(a)}`;
    })
    .join(' ');

  // Circle positions for data dots
  const dots = dims.map((d, i) => {
    const a = angleOf(i);
    const pct = Math.max(0, Math.min(100, d.value)) / 100;
    return { x: cx + r * pct * Math.cos(a), y: cy + r * pct * Math.sin(a) };
  });

  // Label positions: push slightly beyond the outer edge
  const labelRadius = r + 18;
  const labels = dims.map((d, i) => {
    const a = angleOf(i);
    const x = cx + labelRadius * Math.cos(a);
    const y = cy + labelRadius * Math.sin(a);
    // Text-anchor: left side → start, right side → end, center → middle
    const anchor: 'start' | 'end' | 'middle' = Math.cos(a) > 0.2 ? 'start' : Math.cos(a) < -0.2 ? 'end' : 'middle';
    return { label: d.label, x, y, anchor };
  });

  return (
    <svg
      width={200}
      height={200}
      viewBox="0 0 200 200"
      style={{ display: 'block', overflow: 'visible' }}
      aria-label="Trust radar chart"
    >
      {/* Ring grid */}
      {rings.map((s) => (
        <polygon
          key={s}
          points={ringPoints(s)}
          fill="none"
          stroke="var(--hairline)"
          strokeWidth={1}
        />
      ))}

      {/* Axis lines */}
      {dims.map((_, i) => {
        const a = angleOf(i);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + r * Math.cos(a)}
            y2={cy + r * Math.sin(a)}
            stroke="var(--hairline-strong)"
            strokeWidth={0.8}
          />
        );
      })}

      {/* Filled data polygon */}
      <polygon
        points={dataPoints}
        fill="color-mix(in oklch, var(--accent) 15%, transparent)"
        stroke="var(--accent)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {/* Data dots */}
      {dots.map((dot, i) => (
        <circle
          key={i}
          cx={dot.x}
          cy={dot.y}
          r={3.5}
          fill="var(--accent)"
          stroke="var(--surface)"
          strokeWidth={1.5}
        />
      ))}

      {/* Axis labels */}
      {labels.map((l) => (
        <text
          key={l.label}
          x={l.x}
          y={l.y}
          textAnchor={l.anchor}
          dominantBaseline="central"
          fontSize={9}
          fontFamily="var(--font-sans)"
          fontWeight={500}
          letterSpacing="0.06em"
          textDecoration="none"
          fill="var(--text-dim)"
          style={{ textTransform: 'uppercase' }}
        >
          {l.label.toUpperCase()}
        </text>
      ))}
    </svg>
  );
}

// ── Kpi ────────────────────────────────────────────────────────────────────────

function Kpi({ l, v, sub, tone }: { l: string; v: string | number; sub?: string; tone?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
      <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.025em', color: tone ?? 'var(--text)', marginTop: 2 }}>{v}</div>
      {sub && <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{sub}</div>}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const params = useParams<{ agentId: string }>();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const agentId = params?.agentId;
  const a = demoRegistry.find(ag => ag.id === agentId) ?? demoRegistry[0]!;
  const color = ROLE_COLORS[a.role] ?? 'oklch(0.76 0.13 320)';
  const pda = (a as any).agentRegistryPda as string | undefined;

  const trustBase = a.trustScore;
  const trustDims: RadarDim[] = [
    { label: 'Accuracy',  value: Math.min(100, Math.round(trustBase * 1.02)) },
    { label: 'Latency',   value: Math.min(100, Math.round(trustBase * 0.97)) },
    { label: 'Citation',  value: Math.min(100, Math.round(trustBase * 1.01)) },
    { label: 'Cost eff.', value: Math.min(100, Math.round(trustBase * 0.98 + 2)) },
    { label: 'Uptime',    value: Math.min(100, Math.round(trustBase * 1.03)) },
    { label: 'Disputes',  value: Math.min(100, Math.round(trustBase * 0.96 + 4)) },
  ];

  const [td0, td1, td2, td3, td4, td5] = trustDims;

  const trustBarDims = [
    { label: 'Factual support',     v: td0!.value, color: 'var(--ok)' },
    { label: 'Timing accuracy',     v: td1!.value, color: 'var(--accent)' },
    { label: 'Citation discipline', v: td2!.value, color: 'var(--ok)' },
    { label: 'Cost efficiency',     v: td3!.value, color: 'var(--accent)' },
    { label: 'Uptime',              v: td4!.value, color: 'var(--ok)' },
    { label: 'Dispute history',     v: td5!.value, color: 'var(--ok)' },
  ];

  const history = ROLE_REP_HISTORY[a.role] ?? ROLE_REP_HISTORY['execution']!;

  const handleCopyWallet = () => {
    navigator.clipboard.writeText(a.wallet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <Shell
      title={a.name}
      subtitle={`${a.role} agent · ${a.registrationStatus ?? 'active'}`}
    >
      {/* Hero card */}
      <Card style={{ marginBottom: 14, padding: '24px 28px', overflow: 'hidden' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 22 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20,
            background: color.replace(')', ' / 0.14)'), color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${color.replace(')', ' / 0.35)')}`,
            boxShadow: `0 0 40px -8px ${color.replace(')', ' / 0.4)')}`,
            flexShrink: 0,
          }}>
            <AgentIcon role={a.role} size={42} color={color} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 500, letterSpacing: '-0.025em' }}>{a.name}</h2>
              <Pill tone="ok">active</Pill>
              {a.verifierCompatible && <Pill tone="accent" dot={false}>verifier-compatible</Pill>}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>{a.description}</div>
            <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--text-dim)', flexWrap: 'wrap', alignItems: 'center' }}>
              <span>wallet · <span className="mono" style={{ color: 'var(--text-muted)' }}>{a.wallet.length > 12 ? `${a.wallet.slice(0, 4)}…${a.wallet.slice(-4)}` : a.wallet}</span></span>
              <span>role · <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{a.role}</span></span>
              {pda && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  registry · <TxLink signature={pda} cluster="devnet" kind="address" short />
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, auto)', gap: 28 }}>
            <Kpi l="Missions" v={a.totalMissions} />
            <Kpi l="Pass rate" v={`${Math.round(a.trustScore * 0.98)}%`} tone="var(--ok)" />
            <Kpi l="Avg spend" v="0.84" sub="USDC" />
            <Kpi l="Trust" v={a.trustScore} tone={color} />
          </div>
        </div>
      </Card>

      {/* Action row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <Btn
          variant="ghost"
          size="sm"
          icon="copy"
          onClick={handleCopyWallet}
          style={copied ? { color: 'var(--ok)' } : undefined}
        >
          {copied ? 'Copied!' : 'Copy wallet'}
        </Btn>
        <Btn variant="ghost" size="sm" icon="arrow" onClick={() => router.push('/agents')}>
          Back to agents
        </Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Trust breakdown — radar chart */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Trust breakdown</div>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'capitalize' }}>
                role: {a.role}
              </span>
            </div>

            {/* Radar + legend side-by-side */}
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 200px', display: 'flex', justifyContent: 'center' }}>
                <RadarChart dims={trustDims} />
              </div>

              {/* Accessibility rows */}
              <div style={{ flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}>
                {trustBarDims.map(d => (
                  <div key={d.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-muted)' }}>{d.label}</span>
                      <span className="mono" style={{ color: 'var(--text)', fontWeight: 500 }}>{d.v}</span>
                    </div>
                    <div style={{ height: 3, borderRadius: 2, background: 'var(--surface-2)', overflow: 'hidden' }}>
                      <div style={{ width: `${d.v}%`, height: '100%', background: d.color, borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Capabilities */}
          <Card>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>Certified capabilities</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {a.capabilities.slice(0, 4).map((cap, i) => {
                const score = Math.round(trustBase - i * 2);
                const c = { name: cap, v: `v1.${3 - i}.0`, score };
                return (
                <div key={c.name} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 10,
                  background: 'var(--surface-2)', border: '1px solid var(--hairline)',
                }}>
                  <Icon name="shield" size={15} style={{ color: 'var(--ok)' }} />
                  <div style={{ flex: 1 }}>
                    <div className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>evaluated · {c.v}</div>
                  </div>
                  <Pill tone="ok">score {c.score}</Pill>
                </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Reputation history */}
        <Card pad={0}>
          <div style={{
            padding: '16px 20px', borderBottom: '1px solid var(--hairline)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Reputation history</div>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>last 30 days</span>
          </div>
          {history.map((h, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center',
              padding: '12px 20px',
              borderBottom: i < history.length - 1 ? '1px solid var(--hairline)' : 'none',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 450 }}>{h.m}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{h.t}</div>
              </div>
              <Pill tone={h.tone as 'ok' | 'warn' | 'default'}>{h.d}</Pill>
            </div>
          ))}
        </Card>
      </div>
    </Shell>
  );
}
