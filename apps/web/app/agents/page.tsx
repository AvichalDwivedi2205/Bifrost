'use client';
import type { RegistryAgent } from '@bifrost/shared';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/ui/shell';
import { Card, Btn, Pill } from '@/components/ui/primitives';
import { AgentIcon } from '@/components/ui/agent-icons';
import { Icon } from '@/components/ui/icons';
import { fetchRegistry } from '@/lib/api';

const DOMAINS = [
  'planner',
  'execution',
  'verifier',
  'research',
  'compliance',
  'custom',
  'coordinator',
  'news',
  'market',
  'skeptic',
];
const STATUSES = ['active', 'probation', 'submitted', 'unavailable', 'verifier'];
const SORT_OPTIONS = [
  { value: 'trust_desc', label: 'Trust (high → low)' },
  { value: 'name_asc', label: 'Name (A → Z)' },
  { value: 'missions_desc', label: 'Most missions' },
  { value: 'recent', label: 'Recently certified' },
];

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
  custom: 'oklch(0.76 0.13 320)',
};

function agentStatus(agent: RegistryAgent) {
  if (!agent.active) return agent.registrationStatus ?? 'unavailable';
  return agent.registrationStatus ?? 'active';
}

function statusTone(status: string) {
  if (status === 'active' || status === 'certified') return 'ok';
  if (status === 'rejected' || status === 'suspended' || status === 'unavailable') return 'danger';
  if (status === 'probation' || status === 'submitted' || status === 'protocol_check' || status === 'sandbox_eval') return 'warn';
  return 'default';
}

export default function RegistryPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState('trust_desc');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [agents, setAgents] = useState<RegistryAgent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRegistry()
      .then((items) => {
        if (!cancelled) setAgents(items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Registry unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleDomain = (d: string) => {
    setSelectedDomains(prev => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  };

  const toggleStatus = (s: string) => {
    setSelectedStatuses(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let list = agents.filter((agent) => {
      const currentStatus = agentStatus(agent);
      const haystack = [
        agent.name,
        agent.description,
        agent.capabilities.join(' '),
        agent.supportedServices.join(' '),
        agent.slug,
      ].join(' ').toLowerCase();

      const domainMatch = selectedDomains.size === 0 || selectedDomains.has(agent.role);
      const statusMatch =
        selectedStatuses.size === 0 ||
        selectedStatuses.has(currentStatus) ||
        (selectedStatuses.has('verifier') && agent.verifierCompatible);

      return domainMatch && statusMatch && (!q || haystack.includes(q.toLowerCase()));
    });

    const hasPda = (a: typeof list[0]) => Boolean((a as any).agentRegistryPda);

    if (sortBy === 'trust_desc') {
      list = [...list].sort((a, b) => {
        const pdaDiff = Number(hasPda(b)) - Number(hasPda(a));
        return pdaDiff !== 0 ? pdaDiff : b.trustScore - a.trustScore;
      });
    } else if (sortBy === 'name_asc') {
      list = [...list].sort((a, b) => {
        const pdaDiff = Number(hasPda(b)) - Number(hasPda(a));
        return pdaDiff !== 0 ? pdaDiff : a.name.localeCompare(b.name);
      });
    } else if (sortBy === 'missions_desc') {
      list = [...list].sort((a, b) => {
        const pdaDiff = Number(hasPda(b)) - Number(hasPda(a));
        return pdaDiff !== 0 ? pdaDiff : b.totalMissions - a.totalMissions;
      });
    } else {
      list = [...list].sort((a, b) => Number(hasPda(b)) - Number(hasPda(a)));
    }

    return list;
  }, [agents, selectedDomains, selectedStatuses, sortBy, q]);

  const activeCount = agents.filter((agent) => agentStatus(agent) === 'active').length;

  const hasActiveFilters = selectedDomains.size > 0 || selectedStatuses.size > 0 || sortBy !== 'trust_desc';

  return (
    <Shell
      title="Agent Registry"
      subtitle={`${agents.length} agents · ${activeCount} active · ${agents.filter(a => a.verifierCompatible).length} verifier-compatible`}
      actions={
        <Btn variant="primary" size="sm" icon="plus" onClick={() => router.push('/agents/apply')}>
          Register agent
        </Btn>
      }
    >
      {/* Search row */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 10,
          background: 'var(--surface)', border: '1px solid var(--hairline)',
        }}>
          <Icon name="search" size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search by capability, domain, or name…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
            }}
          />
          {q && (
            <button
              onClick={() => setQ('')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                color: 'var(--text-dim)', display: 'flex', alignItems: 'center',
              }}
            >
              <Icon name="x" size={13} />
            </button>
          )}
        </div>
        <Btn
          variant={drawerOpen ? 'default' : 'ghost'}
          size="sm"
          icon="filter"
          onClick={() => setDrawerOpen(v => !v)}
          style={{
            border: drawerOpen ? '1px solid var(--accent)' : undefined,
            color: drawerOpen ? 'var(--accent)' : undefined,
            background: drawerOpen ? 'var(--accent-soft)' : undefined,
          }}
        >
          Filters{hasActiveFilters ? ` · ${selectedDomains.size + selectedStatuses.size + (sortBy !== 'trust_desc' ? 1 : 0)}` : ''}
        </Btn>
      </div>

      {/* Active filter chips */}
      {(selectedDomains.size > 0 || selectedStatuses.size > 0 || sortBy !== 'trust_desc') && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {[...selectedDomains].map(d => (
            <button
              key={`domain-${d}`}
              onClick={() => toggleDomain(d)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
                background: 'var(--accent-soft)', color: 'var(--accent)',
                border: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)',
                fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
              }}
            >
              Domain: {d.replace(/_/g, ' ')}
              <Icon name="x" size={11} />
            </button>
          ))}
          {[...selectedStatuses].map(s => (
            <button
              key={`status-${s}`}
              onClick={() => toggleStatus(s)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
                background: 'var(--accent-soft)', color: 'var(--accent)',
                border: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)',
                fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
              }}
            >
              Status: {s}
              <Icon name="x" size={11} />
            </button>
          ))}
          {sortBy !== 'trust_desc' && (
            <button
              onClick={() => setSortBy('trust_desc')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
                background: 'var(--accent-soft)', color: 'var(--accent)',
                border: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)',
                fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
              }}
            >
              Sort: {SORT_OPTIONS.find(o => o.value === sortBy)?.label}
              <Icon name="x" size={11} />
            </button>
          )}
          <button
            onClick={() => { setSelectedDomains(new Set()); setSelectedStatuses(new Set()); setSortBy('trust_desc'); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
              background: 'transparent', color: 'var(--text-dim)',
              border: '1px solid var(--hairline)',
              fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
            }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* Filter drawer */}
      <div style={{
        overflow: 'hidden',
        maxHeight: drawerOpen ? 500 : 0,
        transition: 'max-height 0.28s var(--ease)',
        marginBottom: drawerOpen ? 10 : 0,
      }}>
        <Card pad={20} style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          {/* Domain group */}
          <div style={{ flex: '1 1 220px' }}>
            <div style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase',
              color: 'var(--text-dim)', marginBottom: 12,
            }}>
              Domain
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DOMAINS.map(d => (
                <label key={d} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedDomains.has(d)}
                    onChange={() => toggleDomain(d)}
                    style={{ accentColor: 'var(--accent)', width: 14, height: 14, cursor: 'pointer' }}
                  />
                  <span style={{
                    fontSize: 13, color: selectedDomains.has(d) ? 'var(--text)' : 'var(--text-muted)',
                    textTransform: 'capitalize',
                  }}>
                    {d.replace(/_/g, ' ')}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, background: 'var(--hairline)', alignSelf: 'stretch' }} />

          {/* Status group */}
          <div style={{ flex: '1 1 160px' }}>
            <div style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase',
              color: 'var(--text-dim)', marginBottom: 12,
            }}>
              Status
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {STATUSES.map(s => (
                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedStatuses.has(s)}
                    onChange={() => toggleStatus(s)}
                    style={{ accentColor: 'var(--accent)', width: 14, height: 14, cursor: 'pointer' }}
                  />
                  <span style={{
                    fontSize: 13, color: selectedStatuses.has(s) ? 'var(--text)' : 'var(--text-muted)',
                    textTransform: 'capitalize',
                  }}>
                    {s}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, background: 'var(--hairline)', alignSelf: 'stretch' }} />

          {/* Sort group */}
          <div style={{ flex: '1 1 200px' }}>
            <div style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase',
              color: 'var(--text-dim)', marginBottom: 12,
            }}>
              Sort
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SORT_OPTIONS.map(opt => (
                <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="sort"
                    value={opt.value}
                    checked={sortBy === opt.value}
                    onChange={() => setSortBy(opt.value)}
                    style={{ accentColor: 'var(--accent)', width: 14, height: 14, cursor: 'pointer' }}
                  />
                  <span style={{
                    fontSize: 13, color: sortBy === opt.value ? 'var(--text)' : 'var(--text-muted)',
                  }}>
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {error ? <Card pad={14} style={{ marginBottom: 14, color: 'var(--danger)' }}>{error}</Card> : null}

      {/* Results summary */}
      {(selectedDomains.size > 0 || selectedStatuses.size > 0 || q) && (
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''} matching current filters
        </div>
      )}

      {/* Agent grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {filtered.map(a => {
          const color = ROLE_COLORS[a.role] ?? 'oklch(0.76 0.13 320)';
          const currentStatus = agentStatus(a);
          const topCategory = Object.entries(a.trustProfile?.categoryScores ?? {}).sort((left, right) => right[1] - left[1])[0];
          return (
            <Card key={a.id} onClick={() => router.push(`/agents/${a.id}`)} style={{ cursor: 'pointer', minHeight: 265 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 11, flexShrink: 0,
                  background: color.replace(')', ' / 0.14)'), color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${color.replace(')', ' / 0.3)')}`,
                }}>
                  <AgentIcon role={a.role} size={24} color={color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: '-0.015em' }}>{a.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-dim)', textTransform: 'capitalize', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.role} · <span className="mono">{a.wallet.length > 12 ? `${a.wallet.slice(0, 4)}…${a.wallet.slice(-4)}` : a.wallet}</span>
                  </div>
                </div>
                <Pill tone={statusTone(currentStatus)}>{currentStatus}</Pill>
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                {topCategory && (
                  <Pill tone="accent" dot={false}>
                    {topCategory[0]} · {topCategory[1]}
                  </Pill>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, minHeight: 54 }}>{a.description}</div>
              <div style={{ display: 'flex', gap: 4, marginTop: 12, flexWrap: 'wrap' }}>
                {a.capabilities.slice(0, 4).map(t => (
                  <span key={t} style={{
                    padding: '2px 8px', borderRadius: 6,
                    background: 'var(--surface-2)', fontSize: 10.5, color: 'var(--text-muted)',
                    border: '1px solid var(--hairline)', fontFamily: 'var(--font-mono)',
                  }}>{t}</span>
                ))}
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14,
                paddingTop: 12, borderTop: '1px solid var(--hairline)',
              }}>
                <div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Trust</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <span style={{ fontSize: 15, fontWeight: 500 }}>{a.trustScore}</span>
                    <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--surface-2)' }}>
                      <div style={{ width: `${a.trustScore}%`, height: '100%', background: color, borderRadius: 2 }} />
                    </div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Missions</div>
                  <div style={{ fontSize: 15, fontWeight: 500, marginTop: 3 }}>{a.totalMissions}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                {a.verifierCompatible ? <Pill tone="accent">verifier-ready</Pill> : null}
                <Pill tone="default">{a.executionMode}</Pill>
                {a.trustProfile?.disputedMissions === 0 ? <Pill tone="ok">0 disputes</Pill> : null}
              </div>
            </Card>
          );
        })}
      </div>
    </Shell>
  );
}
