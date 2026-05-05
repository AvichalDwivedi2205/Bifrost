'use client';
import React from 'react';
import { Shell } from '@/components/ui/shell';
import { Card } from '@/components/ui/primitives';
import { AgentIcon } from '@/components/ui/agent-icons';
import { AGENTS } from '@/components/ui/data';

// ── SVG Charts ────────────────────────────────────────────────────────────────
function ThroughputChart() {
  const days = 30;
  const data = Array.from({ length: days }, (_, i) => {
    const seed = Math.sin(i * 0.8) * 0.5 + 0.5;
    const noise = Math.sin(i * 2.3) * 0.15;
    return {
      completed: Math.round(34 + seed * 26 + noise * 20),
      failed: Math.round(1 + Math.abs(Math.sin(i * 1.7)) * 3),
    };
  });
  const maxV = Math.max(...data.map(d => d.completed + d.failed));
  const W = 800, H = 200;
  const padL = 36, padR = 12, padT = 10, padB = 28;
  const iw = W - padL - padR, ih = H - padT - padB;
  const xOf = (i: number) => padL + (i / (days - 1)) * iw;
  const yOf = (v: number) => padT + ih - (v / maxV) * ih;

  const pts = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i)} ${yOf(d.completed)}`).join(' ');
  const areaPath = `${pts} L ${xOf(days - 1)} ${padT + ih} L ${xOf(0)} ${padT + ih} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--plasma-2)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--plasma-2)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
        const y = padT + ih - f * ih;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--hairline)" strokeDasharray="2 4" />
            <text x={padL - 8} y={y + 3} textAnchor="end" fontSize="10" fill="var(--text-dim)" fontFamily="Geist Mono">{Math.round(f * maxV)}</text>
          </g>
        );
      })}
      <path d={areaPath} fill="url(#areaGrad)" />
      <path d={pts} fill="none" stroke="var(--plasma-2)" strokeWidth="1.5" strokeLinejoin="round" />
      {data.map((d, i) => (
        <rect key={i} x={xOf(i) - 2} y={yOf(d.failed)} width={4} height={(d.failed / maxV) * ih} fill="var(--danger)" opacity="0.5" />
      ))}
      {[0, 6, 12, 18, 24, 29].map(i => (
        <text key={i} x={xOf(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--text-dim)" fontFamily="Geist Mono">d-{days - i}</text>
      ))}
    </svg>
  );
}

function BudgetDonut() {
  const slices = [
    { label: 'news', pct: 28, color: 'oklch(0.78 0.14 75)' },
    { label: 'market', pct: 32, color: 'oklch(0.76 0.16 245)' },
    { label: 'execution', pct: 22, color: 'oklch(0.80 0.14 195)' },
    { label: 'verify', pct: 12, color: 'oklch(0.72 0.14 155)' },
    { label: 'other', pct: 6, color: 'oklch(0.55 0.012 260)' },
  ];
  const cx = 100, cy = 100, r = 72, inner = 46;
  let angle = -90;
  const paths = slices.map(s => {
    const start = (angle * Math.PI) / 180;
    angle += (s.pct / 100) * 360;
    const end = (angle * Math.PI) / 180;
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    const xi1 = cx + inner * Math.cos(start), yi1 = cy + inner * Math.sin(start);
    const xi2 = cx + inner * Math.cos(end), yi2 = cy + inner * Math.sin(end);
    const large = s.pct > 50 ? 1 : 0;
    return { ...s, d: `M ${xi1} ${yi1} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${inner} ${inner} 0 ${large} 0 ${xi1} ${yi1} Z` };
  });

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
      <svg viewBox="0 0 200 200" style={{ width: 180, height: 180, flexShrink: 0 }}>
        {paths.map(p => <path key={p.label} d={p.d} fill={p.color} opacity="0.85" />)}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="500" fill="var(--text)" fontFamily="Geist">$124.8k</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="var(--text-dim)" fontFamily="Geist">total settled</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {slices.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize', width: 60 }}>{s.label}</span>
            <span className="mono" style={{ color: 'var(--text)' }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const SERVICES = [
  { name: 'polymarket.api', calls: 1842, pct: 100, trend: '+12%' },
  { name: 'newsapi.io', calls: 1504, pct: 82, trend: '+4%' },
  { name: 'gecko.pro', calls: 1102, pct: 60, trend: '+22%' },
  { name: 'dune.query', calls: 921, pct: 50, trend: '-3%' },
  { name: 'helius.rpc', calls: 744, pct: 40, trend: '+8%' },
  { name: 'etherscan.v2', calls: 512, pct: 28, trend: '+1%' },
];

const KPIS = [
  { l: 'Missions completed', v: '1,209', s: '+142 vs prev.', tone: 'var(--ok)', delta: '+13%' },
  { l: 'Completion rate', v: '94.2%', s: 'of 1,284 started', delta: '+1.8pts' },
  { l: 'Avg USDC / mission', v: '6.42', s: 'median 5.18', delta: '-$0.34' },
  { l: 'Verification pass', v: '98.2%', s: '14,918 / 15,190', tone: 'var(--ok)', delta: '+0.4pts' },
];

export default function InsightsPage() {
  const topAgents = [...AGENTS].sort((a, b) => b.trust - a.trust).slice(0, 6);

  return (
    <Shell
      title="Insights"
      subtitle="System-wide metrics and trends"
    >
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
        {KPIS.map(k => (
          <Card key={k.l} pad={18}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>{k.l}</div>
              <span className="mono" style={{ fontSize: 10.5, color: k.delta.charAt(0) === '-' ? 'var(--danger)' : 'var(--ok)' }}>{k.delta}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.025em', marginTop: 6, color: k.tone || 'var(--text)' }}>{k.v}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{k.s}</div>
          </Card>
        ))}
      </div>

      {/* Charts row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14, marginBottom: 14 }}>
        <Card pad={0}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--hairline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Mission throughput</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 2 }}>Completed per day · failed stacked</div>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--plasma-2)' }} /> completed
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--danger)', opacity: 0.55 }} /> failed
              </span>
            </div>
          </div>
          <div style={{ padding: '16px 14px 4px' }}>
            <ThroughputChart />
          </div>
        </Card>

        <Card pad={0}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--hairline)' }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Where the USDC went</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 2 }}>Across all settled missions</div>
          </div>
          <div style={{ padding: '22px 20px' }}>
            <BudgetDonut />
          </div>
        </Card>
      </div>

      {/* Data rows */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14, marginBottom: 14 }}>
        <Card pad={0}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--hairline)', display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Top services used</div>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>by call volume</span>
          </div>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {SERVICES.map(s => (
              <div key={s.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
                  <span className="mono" style={{ color: 'var(--text)' }}>{s.name}</span>
                  <span style={{ display: 'flex', gap: 10 }}>
                    <span className="mono" style={{ color: s.trend.charAt(0) === '-' ? 'var(--danger)' : 'var(--ok)' }}>{s.trend}</span>
                    <span className="mono" style={{ color: 'var(--text-muted)' }}>{s.calls.toLocaleString()}</span>
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${s.pct}%`, height: '100%',
                    background: 'linear-gradient(90deg, var(--plasma-2), var(--plasma-4))', borderRadius: 3,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card pad={0}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--hairline)', display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Top agents by trust</div>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>30d avg</span>
          </div>
          <div>
            {topAgents.map((a, i) => (
              <div key={a.id} style={{
                display: 'grid', gridTemplateColumns: '20px 36px 1fr auto', gap: 12,
                padding: '12px 20px', alignItems: 'center',
                borderBottom: i < topAgents.length - 1 ? '1px solid var(--hairline)' : 'none',
              }}>
                <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>#{i + 1}</span>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: a.color.replace(')', ' / 0.14)'), color: a.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <AgentIcon role={a.role} size={16} color={a.color} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{a.missions} missions</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: a.color }}>{a.trust}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

    </Shell>
  );
}
