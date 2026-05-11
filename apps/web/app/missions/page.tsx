'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MissionRecord } from '@bifrost/shared';
import { demoRegistry } from '@bifrost/shared';
import { Shell } from '@/components/ui/shell';
import { Card, Pill } from '@/components/ui/primitives';
import { AgentIcon } from '@/components/ui/agent-icons';
import { listMissions } from '@/lib/api';

const ROLE_COLORS: Record<string, string> = {
  coordinator: 'oklch(0.78 0.16 180)',
  news: 'oklch(0.78 0.14 75)',
  market: 'oklch(0.76 0.16 245)',
  skeptic: 'oklch(0.70 0.18 295)',
  research: 'oklch(0.72 0.13 250)',
  risk: 'oklch(0.65 0.20 25)',
  compliance: 'oklch(0.72 0.12 145)',
  execution: 'oklch(0.80 0.14 195)',
  verifier: 'oklch(0.72 0.14 155)',
  planner: 'oklch(0.78 0.14 75)',
  custom: 'oklch(0.76 0.13 320)',
};

function statusTone(s: string): 'ok' | 'warn' | 'danger' | 'pending' | 'default' {
  if (s === 'settled') return 'ok';
  if (s === 'failed') return 'danger';
  if (s === 'active' || s === 'created') return 'pending';
  if (s === 'selection_pending') return 'warn';
  return 'default';
}

function fmtUsdc(n: number) { return `${n.toFixed(2)} USDC`; }

export default function HistoryPage() {
  const router = useRouter();
  const [missions, setMissions] = useState<MissionRecord[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMissions()
      .then(setMissions)
      .catch(() => setMissions([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? missions : missions.filter(m => {
    if (filter === 'settled') return m.status === 'settled';
    if (filter === 'running') return m.status === 'active' || m.status === 'created' || m.status === 'selection_pending';
    if (filter === 'failed') return m.status === 'failed';
    return true;
  });

  const settled = missions.filter(m => m.status === 'settled').length;
  const value = missions.filter(m => m.status === 'settled')
    .reduce((s, m) => s + (m.budget?.spent ?? 0), 0);
  const avgBudget = missions.length > 0
    ? missions.reduce((s, m) => s + ((m.budget?.spent ?? 0) / (m.budget?.totalBudget || 1)), 0) / missions.length
    : 0;

  return (
    <Shell
      title="Mission History"
      subtitle="Full record of mission runs and on-chain settlements"
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { l: 'Total missions', v: loading ? '…' : missions.length, s: 'all time' },
          { l: 'Settled', v: loading ? '…' : settled, s: missions.length > 0 ? `${((settled / missions.length) * 100).toFixed(0)}% completion` : '—' },
          { l: 'Total settled', v: loading ? '…' : `$${value.toFixed(2)}`, s: 'USDC' },
          { l: 'Avg budget used', v: loading ? '…' : `${(avgBudget * 100).toFixed(0)}%`, s: 'of allocation' },
        ].map(k => (
          <Card key={k.l} pad={18}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>{k.l}</div>
            <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.025em', marginTop: 4 }}>{k.v}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{k.s}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {['all', 'settled', 'running', 'failed'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
            background: filter === f ? 'var(--accent-soft)' : 'var(--surface-2)',
            color: filter === f ? 'var(--accent)' : 'var(--text-muted)',
            border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--hairline)'}`,
            fontSize: 12, textTransform: 'capitalize', fontWeight: 500,
          }}>{f}</button>
        ))}
      </div>

      <Card pad={0}>
        <div style={{
          display: 'grid', gridTemplateColumns: '2.2fr 1fr 1fr 0.9fr 0.9fr 0.9fr 0.9fr',
          padding: '12px 20px', borderBottom: '1px solid var(--hairline)',
          fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500,
        }}>
          <span>Mission</span><span>Type</span><span>Agents</span><span>Spent</span>
          <span>Duration</span><span>Outcome</span><span>Tx</span>
        </div>
        {loading && (
          <div style={{ padding: '28px 20px', color: 'var(--text-dim)', fontSize: 13 }}>Loading missions…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: '28px 20px', color: 'var(--text-dim)', fontSize: 13 }}>No missions found.</div>
        )}
        {filtered.map((m, i) => {
          const settleTx = m.receipts?.[0]?.txSignature
            ?? (m as any).settlement?.settleTxSignature
            ?? '';
          const shortTx = settleTx.length > 8 ? `${settleTx.slice(0, 4)}…${settleTx.slice(-4)}` : settleTx;
          return (
            <div
              key={m.id}
              onClick={() => router.push(`/missions/${m.id}`)}
              style={{
                display: 'grid', gridTemplateColumns: '2.2fr 1fr 1fr 0.9fr 0.9fr 0.9fr 0.9fr',
                padding: '14px 20px', alignItems: 'center', gap: 8,
                borderBottom: i < filtered.length - 1 ? '1px solid var(--hairline)' : 'none',
                fontSize: 13, cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <div>
                <div style={{ fontWeight: 500 }}>{m.input?.title ?? m.id}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{m.id}</div>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{m.input?.template ?? '—'}</div>
              <div style={{ display: 'flex' }}>
                {(m.agents ?? []).slice(0, 4).map((agent, ai) => {
                  const reg = demoRegistry.find(x => x.id === agent.id);
                  const role = reg?.role ?? agent.role ?? 'custom';
                  const color = ROLE_COLORS[role] ?? 'oklch(0.76 0.13 320)';
                  return (
                    <span key={agent.id} title={agent.name} style={{
                      width: 22, height: 22, borderRadius: 6,
                      background: color.replace(')', ' / 0.14)'), color,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      marginLeft: ai === 0 ? 0 : -6, border: '1.5px solid var(--surface)',
                    }}>
                      <AgentIcon role={role} size={12} color={color} />
                    </span>
                  );
                })}
                {(m.agents?.length ?? 0) > 4 && (
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 4, alignSelf: 'center' }}>
                    +{(m.agents?.length ?? 0) - 4}
                  </span>
                )}
              </div>
              <div className="mono" style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{fmtUsdc(m.budget?.spent ?? 0)}</div>
              <div className="mono" style={{ color: 'var(--text-dim)', fontSize: 12 }}>{m.elapsedLabel ?? '—'}</div>
              <div><Pill tone={statusTone(m.status)}>{m.status}</Pill></div>
              <div className="mono" style={{ color: 'var(--accent)', fontSize: 11.5 }}>{shortTx || '—'}</div>
            </div>
          );
        })}
      </Card>
    </Shell>
  );
}
