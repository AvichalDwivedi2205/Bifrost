'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import type { MissionRecord, MissionVerificationReport, AgentMessage } from '@bifrost/shared';
import {
  fetchMission,
  fetchMissionVerification,
  fetchMissionMessages,
  fetchMissionArtifacts,
  type MissionArtifacts,
} from '@/lib/api';
import AgentCommsThread from '@/components/AgentCommsThread';
import { Pill } from '@/components/ui/primitives';
import VerificationCheckRow from '@/components/VerificationCheckRow';
import { ProofCard } from '@/components/ProofCard';

// ── helpers ────────────────────────────────────────────────────────────────────
function truncateMid(s: string, keep = 8): string {
  if (s.length <= keep * 2 + 3) return s;
  return `${s.slice(0, keep)}…${s.slice(-keep)}`;
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusTone(s: string): string {
  if (s === 'settled') return 'ok';
  if (s === 'failed' || s === 'cancelled') return 'danger';
  if (s === 'verifying') return 'pending';
  return 'default';
}

// ── skeleton ───────────────────────────────────────────────────────────────────
function SkeletonLine({ w = '100%', h = 14 }: { w?: string | number; h?: number }) {
  return (
    <div style={{
      width: w,
      height: h,
      borderRadius: 6,
      background: 'var(--surface-2)',
      animation: 'shimmer 1.6s linear infinite',
      backgroundImage: 'linear-gradient(90deg, var(--surface-2) 0%, var(--surface-hover) 50%, var(--surface-2) 100%)',
      backgroundSize: '200% 100%',
    }} />
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[80, 60, 90, 50].map((w, i) => (
        <SkeletonLine key={i} w={`${w}%`} h={16} />
      ))}
    </div>
  );
}

// ── section header ─────────────────────────────────────────────────────────────
function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontSize: 10.5,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      color: 'var(--text-dim)',
      marginBottom: 12,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── card wrapper (no Card primitive: standalone page) ──────────────────────────
function ProofSection({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--hairline)',
      borderRadius: 16,
      padding: '22px 26px',
      boxShadow: 'var(--shadow-sm)',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── copy button ────────────────────────────────────────────────────────────────
function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button
      onClick={copy}
      title="Copy to clipboard"
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '2px 6px',
        borderRadius: 6,
        fontSize: 11,
        fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
        color: copied ? 'var(--ok)' : 'var(--accent)',
        transition: 'color 0.2s',
        userSelect: 'none',
      }}
    >
      {copied ? '✓ copied' : (label ?? 'copy')}
    </button>
  );
}

// ── share button ───────────────────────────────────────────────────────────────
function ShareButton() {
  const [copied, setCopied] = useState(false);
  const share = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };
  return (
    <button
      onClick={share}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 16px',
        borderRadius: 999,
        border: '1px solid transparent',
        cursor: 'pointer',
        fontSize: 12.5,
        fontWeight: 500,
        fontFamily: 'var(--font-sans)',
        background: 'linear-gradient(135deg, var(--plasma-2), var(--plasma-1))',
        color: 'white',
        boxShadow: '0 1px 0 0 oklch(1 0 0 / 0.2) inset, 0 6px 20px -6px var(--plasma-1)',
        transition: 'opacity 0.2s',
        letterSpacing: '-0.01em',
      }}
    >
      {copied ? (
        <>
          <span style={{ fontSize: 13 }}>✓</span>
          Copied
        </>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ opacity: 0.85 }}>
            <path d="M9 1.5H11.5V4" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M11.5 1.5L6 7" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M5 3H2.5A1 1 0 001.5 4v6.5A1 1 0 002.5 11.5H9A1 1 0 0010 10.5V8" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Share proof
        </>
      )}
    </button>
  );
}

// ── external link ──────────────────────────────────────────────────────────────
function SolscanLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: 'var(--accent)',
        fontSize: 12,
        fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
        textDecoration: 'none',
        borderBottom: '1px solid color-mix(in oklch, var(--accent) 40%, transparent)',
        paddingBottom: 1,
      }}
    >
      {label}
    </a>
  );
}

// ── main page ──────────────────────────────────────────────────────────────────
export default function ProofPage() {
  const params = useParams();
  const missionId = Array.isArray(params.missionId) ? params.missionId[0] : params.missionId as string;

  const [mission, setMission] = useState<MissionRecord | null>(null);
  const [verification, setVerification] = useState<MissionVerificationReport | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [artifacts, setArtifacts] = useState<MissionArtifacts | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!missionId) return;
    setLoading(true);
    setNotFound(false);
    try {
      const m = await fetchMission(missionId);
      setMission(m);
      const [v, msgs, arts] = await Promise.allSettled([
        fetchMissionVerification(missionId),
        fetchMissionMessages(missionId),
        fetchMissionArtifacts(missionId),
      ]);
      if (v.status === 'fulfilled') setVerification(v.value);
      if (msgs.status === 'fulfilled') setMessages(msgs.value);
      if (arts.status === 'fulfilled') setArtifacts(arts.value);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [missionId]);

  useEffect(() => { load(); }, [load]);

  // ── layout constants ─────────────────────────────────────────────────────────
  const MONO: React.CSSProperties = {
    fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
    letterSpacing: 0,
  };

  // ── grid backdrop ────────────────────────────────────────────────────────────
  const gridBg: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundImage: `
      linear-gradient(var(--grid-line) 1px, transparent 1px),
      linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)
    `,
    backgroundSize: '44px 44px',
    maskImage: 'radial-gradient(ellipse at 50% 30%, black 40%, transparent 80%)',
    WebkitMaskImage: 'radial-gradient(ellipse at 50% 30%, black 40%, transparent 80%)',
    pointerEvents: 'none',
    zIndex: 0,
  };

  const plasmaOrb: React.CSSProperties = {
    position: 'fixed',
    top: '-20vh',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '70vw',
    height: '60vh',
    borderRadius: '50%',
    background: 'radial-gradient(ellipse, color-mix(in oklch, var(--plasma-1) 18%, transparent) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
  };

  // ── render ───────────────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-sans)',
        color: 'var(--text)',
      }}>
        <div style={gridBg} />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.4 }}>⊘</div>
          <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>Proof not available</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            This mission proof is not available.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      fontFamily: 'var(--font-sans)',
      color: 'var(--text)',
      position: 'relative',
    }}>
      {/* Backdrop */}
      <div style={gridBg} />
      <div style={plasmaOrb} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 900, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Nav breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32, fontSize: 12.5, color: 'var(--text-dim)' }}>
          <a href="/" style={{ color: 'var(--text-dim)', textDecoration: 'none' }}>Bifrost</a>
          <span>/</span>
          <span style={{ color: 'var(--text-muted)' }}>Proof</span>
          {missionId && (
            <>
              <span>/</span>
              <span style={{ ...MONO, fontSize: 11.5 }}>{truncateMid(missionId, 6)}</span>
            </>
          )}
        </div>

        {/* ProofCard sticky summary bar — shown once mission data is available */}
        {!loading && mission?.verificationReport?.proofHash ? (
          <div style={{
            position: 'sticky',
            top: 16,
            zIndex: 10,
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'center',
          }}>
            <ProofCard
              proofHash={mission.verificationReport.proofHash}
              artifactCount={artifacts ? Object.keys(artifacts).length : 0}
              completionConfidence={mission.verificationReport.confidence ?? 0}
              onShare={() => {
                if (typeof window !== 'undefined') {
                  navigator.clipboard.writeText(window.location.href);
                }
              }}
            />
          </div>
        ) : null}

        {loading ? (
          <ProofSection>
            <LoadingSkeleton />
          </ProofSection>
        ) : mission ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── 1. Mission header ─────────────────────────────────────────── */}
            <ProofSection>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                    <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>
                      {mission.input.title}
                    </h1>
                    <Pill tone={statusTone(mission.status)} dot>
                      {mission.status.toUpperCase().replace(/_/g, ' ')}
                    </Pill>
                  </div>

                  {/* Proof hash */}
                  {mission.verificationReport?.proofHash ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>PROOF</span>
                      <span style={{
                        ...MONO,
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        background: 'var(--surface-2)',
                        padding: '3px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--hairline)',
                      }}>
                        {truncateMid(mission.verificationReport.proofHash, 10)}
                      </span>
                      <CopyButton text={mission.verificationReport.proofHash} />
                    </div>
                  ) : null}

                  {/* Timestamps */}
                  <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 12, color: 'var(--text-dim)', flexWrap: 'wrap' }}>
                    <span>
                      <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>Created</span>
                      {fmtDate(mission.events[0]?.createdAt)}
                    </span>
                    {mission.status === 'settled' && (
                      <span>
                        <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>Settled</span>
                        {fmtDate(mission.events[mission.events.length - 1]?.createdAt)}
                      </span>
                    )}
                    <span>
                      <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>Mission ID</span>
                      <span style={MONO}>{truncateMid(mission.id, 8)}</span>
                    </span>
                  </div>
                </div>
                <ShareButton />
              </div>
            </ProofSection>

            {/* ── 2. Verification verdict ───────────────────────────────────── */}
            {verification ? (
              <ProofSection>
                <SectionLabel>Verification Verdict</SectionLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
                  {/* Stamp */}
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 22px',
                    borderRadius: 10,
                    border: `2px solid ${verification.approved ? 'var(--ok)' : 'var(--danger)'}`,
                    color: verification.approved ? 'var(--ok)' : 'var(--danger)',
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    boxShadow: verification.approved
                      ? '0 0 24px -6px color-mix(in oklch, var(--ok) 40%, transparent)'
                      : '0 0 24px -6px color-mix(in oklch, var(--danger) 40%, transparent)',
                    transform: 'rotate(-2deg)',
                    userSelect: 'none',
                  }}>
                    {verification.approved ? 'APPROVED' : 'REJECTED'}
                  </div>

                  {/* Score + confidence */}
                  <div style={{ display: 'flex', gap: 28 }}>
                    <div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 500, marginBottom: 4 }}>Score</div>
                      <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', color: verification.approved ? 'var(--ok)' : 'var(--danger)' }}>
                        {Math.round(verification.score * 100)}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>%</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 500, marginBottom: 4 }}>Confidence</div>
                      <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)' }}>
                        {Math.round(verification.confidence * 100)}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                {verification.summary && (
                  <div style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 18 }}>
                    {verification.summary}
                  </div>
                )}

                {/* Deterministic checks grid */}
                {verification.deterministicChecks ? (
                  <div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', fontWeight: 600, marginBottom: 10 }}>
                      Deterministic Checks
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 8 }}>
                      {(Object.entries(verification.deterministicChecks) as [string, boolean][]).map(([key, passed]) => (
                        <VerificationCheckRow
                          key={key}
                          label={key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                          passed={passed}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Passed / failed checks */}
                {(verification.passedChecks?.length > 0 || verification.failedChecks?.length > 0) && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', fontWeight: 600, marginBottom: 10 }}>
                      Check Results
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {[...verification.passedChecks, ...verification.failedChecks].map((c) => (
                        <VerificationCheckRow key={c.id} label={c.label} passed={c.status === 'passed'} detail={c.detail} />
                      ))}
                    </div>
                  </div>
                )}
              </ProofSection>
            ) : null}

            {/* ── Launch deliverables ──────────────────────────────────────── */}
            {mission.deliverables && (
              <ProofSection>
                <SectionLabel>Launch Deliverables</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
                  {[
                    ['Live URL', mission.deliverables.liveUrl],
                    ['Preview URL', mission.deliverables.previewUrl],
                    ['Waitlist endpoint', mission.deliverables.waitlistEndpoint],
                  ].map(([label, value]) => (
                    <div key={label} style={{ border: '1px solid var(--hairline)', borderRadius: 10, padding: 12, background: 'var(--surface-2)' }}>
                      <div style={{ fontSize: 10.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{label}</div>
                      {value ? (
                        <a href={value} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: 12.5, wordBreak: 'break-all' }}>
                          {value}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>pending</span>
                      )}
                    </div>
                  ))}
                </div>

                {mission.deliverables.formTestResult && (
                  <VerificationCheckRow
                    label="Waitlist form test"
                    passed={mission.deliverables.formTestResult.passed}
                    detail={mission.deliverables.formTestResult.detail}
                  />
                )}

                {mission.deliverables.deployReceipt && (
                  <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    Deploy receipt: <span style={MONO}>{mission.deliverables.deployReceipt.deploymentId}</span> via {mission.deliverables.deployReceipt.provider}
                  </div>
                )}

                {(mission.deliverables.fileManifest?.length ?? 0) > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', fontWeight: 600, marginBottom: 8 }}>
                      Files Generated
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {mission.deliverables.fileManifest!.map((file) => (
                        <div key={file.path} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, borderBottom: '1px solid var(--hairline)', paddingBottom: 6 }}>
                          <span style={{ color: 'var(--text-muted)' }}>{file.path}</span>
                          <span style={{ ...MONO, color: 'var(--text-dim)' }}>{truncateMid(file.hash, 6)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(mission.deliverables.socialPosts?.length ?? 0) > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', fontWeight: 600, marginBottom: 8 }}>
                      Launch Posts
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {mission.deliverables.socialPosts!.map((post, index) => (
                        <div key={index} style={{ padding: 10, borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text-muted)', fontSize: 12.5, lineHeight: 1.5 }}>
                          {post}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </ProofSection>
            )}

            {/* ── 3. Agent comms thread ─────────────────────────────────────── */}
            <div>
              <SectionLabel style={{ marginBottom: 6 }}>Agent Communications</SectionLabel>
              <AgentCommsThread
                messages={messages}
                onResolve={undefined}
                readOnly
                emptyHint="No agent messages recorded for this mission."
              />
            </div>

            {/* ── 4. Payment receipts ───────────────────────────────────────── */}
            {mission.receipts.length > 0 && (
              <ProofSection>
                <SectionLabel>Payment Receipts</SectionLabel>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
                        {['Receipt ID', 'Amount', 'Service', 'Payout Wallet', 'Tx Signature'].map((h) => (
                          <th key={h} style={{
                            textAlign: 'left',
                            padding: '8px 12px',
                            fontSize: 10.5,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.07em',
                            color: 'var(--text-dim)',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mission.receipts.map((r, i) => (
                        <tr key={r.receiptId} style={{ borderBottom: i < mission.receipts.length - 1 ? '1px solid var(--hairline)' : 'none' }}>
                          <td style={{ padding: '10px 12px', ...MONO, color: 'var(--text-muted)', fontSize: 11.5 }}>
                            {truncateMid(r.receiptId, 6)}
                          </td>
                          <td style={{ padding: '10px 12px', ...MONO, fontWeight: 600, color: 'var(--text)' }}>
                            {r.amount.toFixed(4)} <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>USDC</span>
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{r.purpose || r.toolName}</td>
                          <td style={{ padding: '10px 12px', ...MONO, fontSize: 11 }}>
                            {r.serviceWallet ? truncateMid(r.serviceWallet, 5) : '—'}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {r.txSignature ? (
                              <SolscanLink
                                href={`https://solscan.io/tx/${r.txSignature}?cluster=devnet`}
                                label={truncateMid(r.txSignature, 6)}
                              />
                            ) : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ProofSection>
            )}

            {/* ── 5. On-chain proof ──────────────────────────────────────────── */}
            {mission.chain && (
              <ProofSection>
                <SectionLabel>On-Chain Proof</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {mission.chain.missionPda && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-dim)', minWidth: 140 }}>Mission PDA</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ ...MONO, fontSize: 12, color: 'var(--text-muted)' }}>{truncateMid(mission.chain.missionPda, 8)}</span>
                        <SolscanLink
                          href={`https://solscan.io/account/${mission.chain.missionPda}?cluster=devnet`}
                          label="View account"
                        />
                        <CopyButton text={mission.chain.missionPda} />
                      </div>
                    </div>
                  )}
                  {mission.chain.verificationPda && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-dim)', minWidth: 140 }}>Verification PDA</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ ...MONO, fontSize: 12, color: 'var(--text-muted)' }}>{truncateMid(mission.chain.verificationPda, 8)}</span>
                        <SolscanLink
                          href={`https://solscan.io/account/${mission.chain.verificationPda}?cluster=devnet`}
                          label="View account"
                        />
                        <CopyButton text={mission.chain.verificationPda} />
                      </div>
                    </div>
                  )}
                  {/* Settlement tx from events */}
                  {mission.events.filter(e => e.type === 'SETTLEMENT_RELEASED').map((e, i) => {
                    const sig = 'txSignature' in e ? e.txSignature : undefined;
                    return sig ? (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-dim)', minWidth: 140 }}>Settlement Tx</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ ...MONO, fontSize: 12, color: 'var(--text-muted)' }}>{truncateMid(sig, 8)}</span>
                          <SolscanLink
                            href={`https://solscan.io/tx/${sig}?cluster=devnet`}
                            label="View tx"
                          />
                          <CopyButton text={sig} />
                        </div>
                      </div>
                    ) : null;
                  })}
                </div>
              </ProofSection>
            )}

            {/* ── 6. Artifact refs ──────────────────────────────────────────── */}
            {artifacts && Object.keys(artifacts).length > 0 && (
              <ProofSection>
                <SectionLabel>Artifacts</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(Object.entries(artifacts) as [string, { summary: string; artifactRef: string } | { verdict?: string; recommendation?: string; headline?: string; confidence?: number; keyPoints?: string[]; artifactRef: string }][]).map(([key, val]) => (
                    <div key={key} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 14,
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: 'var(--surface-2)',
                      border: '1px solid var(--hairline)',
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 7,
                        background: 'color-mix(in oklch, var(--accent) 14%, transparent)',
                        color: 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, flexShrink: 0,
                        textTransform: 'uppercase',
                      }}>
                        {key[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500, textTransform: 'capitalize', marginBottom: 4 }}>{key}</div>
                        <div style={{ ...MONO, fontSize: 11, color: 'var(--text-dim)', wordBreak: 'break-all' }}>
                          {val.artifactRef}
                        </div>
                        {'summary' in val && val.summary && (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                            {(val as { summary: string }).summary}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ProofSection>
            )}

          </div>
        ) : null}
      </div>
    </div>
  );
}
