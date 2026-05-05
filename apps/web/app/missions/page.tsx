'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/ui/shell';
import { Card, Pill } from '@/components/ui/primitives';
import { AgentIcon } from '@/components/ui/agent-icons';
import { AGENTS, MISSIONS, STATUS_TONE, fmtUsdc } from '@/components/ui/data';

export default function HistoryPage() {
  const router = useRouter();
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? MISSIONS : MISSIONS.filter(m => m.status === filter);
  const total = MISSIONS.length;
  const settled = MISSIONS.filter(m => m.status === 'settled').length;
  const value = MISSIONS.filter(m => m.status === 'settled').reduce((s, m) => s + m.spent, 0);
  const avgBudget = MISSIONS.reduce((s, m) => s + m.spent / m.budget, 0) / MISSIONS.length;

  return (
    <Shell
      title="Mission History"
      subtitle="Full record of mission runs and on-chain settlements"
    >
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { l: 'Total missions', v: total, s: 'all time' },
          { l: 'Settled', v: settled, s: `${((settled / total) * 100).toFixed(0)}% completion` },
          { l: 'Total settled', v: `$${value.toFixed(2)}`, s: 'USDC' },
          { l: 'Avg budget used', v: `${(avgBudget * 100).toFixed(0)}%`, s: 'of allocation' },
        ].map(k => (
          <Card key={k.l} pad={18}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>{k.l}</div>
            <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.025em', marginTop: 4 }}>{k.v}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{k.s}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
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

      {/* Table */}
      <Card pad={0}>
        <div style={{
          display: 'grid', gridTemplateColumns: '2.2fr 1fr 1fr 0.9fr 0.9fr 0.9fr 0.9fr',
          padding: '12px 20px', borderBottom: '1px solid var(--hairline)',
          fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500,
        }}>
          <span>Mission</span><span>Type</span><span>Agents</span><span>Spent</span>
          <span>Duration</span><span>Outcome</span><span>Tx</span>
        </div>
        {filtered.map((m, i) => (
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
              <div style={{ fontWeight: 500 }}>{m.title}</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{m.id}</div>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{m.template}</div>
            <div style={{ display: 'flex' }}>
              {m.agents.slice(0, 4).map((aid, ai) => {
                const a = AGENTS.find(x => x.id === aid);
                if (!a) return null;
                return (
                  <span key={aid} title={a.name} style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: a.color.replace(')', ' / 0.14)'), color: a.color,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    marginLeft: ai === 0 ? 0 : -6, border: '1.5px solid var(--surface)',
                  }}>
                    <AgentIcon role={a.role} size={12} color={a.color} />
                  </span>
                );
              })}
              {m.agents.length > 4 && <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 4, alignSelf: 'center' }}>+{m.agents.length - 4}</span>}
            </div>
            <div className="mono" style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{fmtUsdc(m.spent)}</div>
            <div className="mono" style={{ color: 'var(--text-dim)', fontSize: 12 }}>{m.duration}</div>
            <div><Pill tone={STATUS_TONE[m.status] as 'ok' | 'warn' | 'danger' | 'pending' | 'default'}>{m.status}</Pill></div>
            <div className="mono" style={{ color: 'var(--accent)', fontSize: 11.5 }}>{m.tx}</div>
          </div>
        ))}
      </Card>
    </Shell>
  );
}
