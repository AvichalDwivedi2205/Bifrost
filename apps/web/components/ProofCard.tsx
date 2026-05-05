'use client';
import React, { useState } from 'react';

export interface ProofCardProps {
  proofHash: string;
  artifactCount: number;
  completionConfidence: number;
  onShare: () => void;
}

function truncateMid(s: string, keep = 8): string {
  if (s.length <= keep * 2 + 3) return s;
  return `${s.slice(0, keep)}…${s.slice(-keep)}`;
}

export function ProofCard({ proofHash, artifactCount, completionConfidence, onShare }: ProofCardProps) {
  const [copied, setCopied] = useState(false);

  const copyHash = () => {
    navigator.clipboard.writeText(proofHash).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const pct = `${Math.round(completionConfidence * 100)}%`;

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border, var(--hairline))',
      borderRadius: 999,
      padding: '10px 18px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 16,
      boxShadow: 'var(--shadow-sm)',
      flexWrap: 'wrap',
    }}>

      {/* Proof hash */}
      <button
        onClick={copyHash}
        title={proofHash}
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border, var(--hairline))',
          borderRadius: 999,
          padding: '4px 12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--muted, var(--text-dim))',
        }}>
          PROOF
        </span>
        <span style={{
          fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
          fontSize: 11.5,
          color: copied ? 'var(--ok)' : 'var(--ink, var(--text))',
          letterSpacing: 0,
        }}>
          {copied ? '✓ copied' : truncateMid(proofHash, 7)}
        </span>
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 18, background: 'var(--border, var(--hairline))' }} />

      {/* Artifact count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--muted, var(--text-dim))',
        }}>
          ARTIFACTS
        </span>
        <span style={{
          fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--ink, var(--text))',
          letterSpacing: 0,
        }}>
          {artifactCount}
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 18, background: 'var(--border, var(--hairline))' }} />

      {/* Confidence */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--muted, var(--text-dim))',
        }}>
          CONFIDENCE
        </span>
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--ok)',
          letterSpacing: '-0.01em',
        }}>
          {pct}
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 18, background: 'var(--border, var(--hairline))' }} />

      {/* Share button */}
      <button
        onClick={onShare}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 14px',
          borderRadius: 999,
          border: '1px solid transparent',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
          fontFamily: 'var(--font-sans)',
          background: 'linear-gradient(135deg, var(--plasma-2), var(--plasma-1))',
          color: 'white',
          boxShadow: '0 1px 0 0 oklch(1 0 0 / 0.2) inset, 0 4px 14px -4px var(--plasma-1)',
          transition: 'opacity 0.2s',
          letterSpacing: '-0.01em',
          userSelect: 'none',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
      >
        <svg width="12" height="12" viewBox="0 0 13 13" fill="none" style={{ opacity: 0.85 }}>
          <path d="M9 1.5H11.5V4" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M11.5 1.5L6 7" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M5 3H2.5A1 1 0 001.5 4v6.5A1 1 0 002.5 11.5H9A1 1 0 0010 10.5V8" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Share
      </button>
    </div>
  );
}

export default ProofCard;
