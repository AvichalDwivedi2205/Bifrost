'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useBifrostWalletModal } from './wallet-modal';

function shorten(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

type Cluster = 'mainnet' | 'devnet' | 'testnet';
function clusterFromEndpoint(endpoint?: string): Cluster {
  if (!endpoint) return 'devnet';
  if (endpoint.includes('devnet')) return 'devnet';
  if (endpoint.includes('testnet')) return 'testnet';
  return 'mainnet';
}

export function WalletMenu() {
  const { connected, connecting, publicKey, wallet, disconnect } = useWallet();
  const { setVisible } = useBifrostWalletModal();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Disconnected: simple connect button.
  if (!connected || !publicKey) {
    return (
      <button
        onClick={() => setVisible(true)}
        disabled={connecting}
        style={{
          height: 32, padding: '0 14px', borderRadius: 'var(--r-sm)',
          background: 'linear-gradient(135deg, var(--plasma-2), var(--plasma-1))',
          border: '1px solid transparent',
          color: 'white', fontSize: 12, fontWeight: 500,
          fontFamily: 'var(--font-sans)', letterSpacing: '-0.01em',
          cursor: connecting ? 'wait' : 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          boxShadow: '0 1px 0 0 oklch(1 0 0 / 0.2) inset, 0 6px 16px -8px var(--plasma-1)',
          transition: 'transform 0.15s var(--ease)',
        }}
      >
        <span style={{
          width: 6, height: 6, borderRadius: 999,
          background: 'white', opacity: connecting ? 0.6 : 0.9,
          animation: connecting ? 'pulse-soft 1.2s infinite' : 'none',
        }} />
        {connecting ? 'Connecting' : 'Connect wallet'}
      </button>
    );
  }

  const addr = publicKey.toBase58();
  const cluster = clusterFromEndpoint(
    typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_SOLANA_RPC_URL : undefined
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* clipboard unavailable */ }
  };

  const change = () => {
    setOpen(false);
    setVisible(true);
  };

  const explorerUrl = `https://explorer.solana.com/address/${addr}${cluster !== 'mainnet' ? `?cluster=${cluster}` : ''}`;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          height: 32, padding: '0 10px 0 8px', borderRadius: 'var(--r-sm)',
          background: 'var(--surface)', border: '1px solid var(--hairline)',
          color: 'var(--text)', fontSize: 12, fontWeight: 500,
          fontFamily: 'var(--font-sans)', letterSpacing: '-0.01em',
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 8,
          transition: 'all 0.15s var(--ease)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)';
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--hairline-strong)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'var(--surface)';
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--hairline)';
        }}
      >
        {wallet?.adapter.icon ? (
          <img src={wallet.adapter.icon} alt="" width={18} height={18} style={{ borderRadius: 4 }} />
        ) : (
          <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--ok)', boxShadow: '0 0 6px var(--ok)' }} />
        )}
        <span className="mono" style={{ fontSize: 11.5 }}>{shorten(addr)}</span>
        <Caret open={open} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
            width: 260, zIndex: 50,
            background: 'var(--bg-elev)',
            border: '1px solid var(--hairline)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden',
            animation: 'fade-up 0.18s var(--ease)',
          }}
        >
          {/* Identity */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--hairline)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {wallet?.adapter.icon ? (
                <img src={wallet.adapter.icon} alt="" width={28} height={28} style={{ borderRadius: 7, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--surface-2)' }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '-0.01em' }}>
                  {wallet?.adapter.name ?? 'Wallet'}
                </div>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>
                  {shorten(addr)} · {cluster}
                </div>
              </div>
              <span style={{
                width: 6, height: 6, borderRadius: 999,
                background: 'var(--ok)', boxShadow: '0 0 6px var(--ok)',
                flexShrink: 0,
              }} />
            </div>
          </div>

          {/* Actions */}
          <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <MenuItem icon={copied ? '✓' : '⧉'} label={copied ? 'Copied' : 'Copy address'} onClick={copy} accent={copied} />
            <MenuItem icon="↗" label="View on Explorer" href={explorerUrl} />
            <MenuItem icon="⇄" label="Change wallet" onClick={change} />
            <div style={{ height: 1, background: 'var(--hairline)', margin: '4px 6px' }} />
            <MenuItem icon="⏻" label="Disconnect" onClick={() => { setOpen(false); disconnect(); }} danger />
          </div>
        </div>
      )}
    </div>
  );
}

function Caret({ open }: { open: boolean }) {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" style={{
      transform: open ? 'rotate(180deg)' : 'none',
      transition: 'transform 0.15s var(--ease)',
      color: 'var(--text-dim)',
    }}>
      <path d="M 1.5 3 L 4.5 6 L 7.5 3" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MenuItem({
  icon, label, onClick, href, danger, accent,
}: {
  icon: string; label: string;
  onClick?: () => void; href?: string;
  danger?: boolean; accent?: boolean;
}) {
  const color = danger ? 'var(--danger)' : accent ? 'var(--ok)' : 'var(--text)';
  const base: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 10px', borderRadius: 7,
    fontSize: 12.5, fontWeight: 450, letterSpacing: '-0.01em',
    color, background: 'transparent',
    border: '1px solid transparent', cursor: 'pointer',
    width: '100%', textAlign: 'left', textDecoration: 'none',
    transition: 'background 0.12s var(--ease)',
  };
  const hover = (e: React.MouseEvent<HTMLElement>) => {
    (e.currentTarget as HTMLElement).style.background = danger
      ? 'color-mix(in oklch, var(--danger) 10%, transparent)'
      : 'var(--surface-hover)';
  };
  const leave = (e: React.MouseEvent<HTMLElement>) => {
    (e.currentTarget as HTMLElement).style.background = 'transparent';
  };
  const inner = (
    <>
      <span style={{
        width: 18, display: 'inline-flex', justifyContent: 'center',
        fontSize: 13, color: danger ? 'var(--danger)' : accent ? 'var(--ok)' : 'var(--text-muted)',
      }}>{icon}</span>
      <span>{label}</span>
    </>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={base} onMouseEnter={hover} onMouseLeave={leave}>
        {inner}
      </a>
    );
  }
  return (
    <button onClick={onClick} style={base} onMouseEnter={hover} onMouseLeave={leave}>
      {inner}
    </button>
  );
}
