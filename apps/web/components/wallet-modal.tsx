'use client';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import type { Wallet } from '@solana/wallet-adapter-react';
import { WalletReadyState } from '@solana/wallet-adapter-base';

type Ctx = { visible: boolean; setVisible: (v: boolean) => void };
const WalletModalCtx = createContext<Ctx | null>(null);

export function useBifrostWalletModal(): Ctx {
  const ctx = useContext(WalletModalCtx);
  if (!ctx) throw new Error('useBifrostWalletModal outside provider');
  return ctx;
}

export function BifrostWalletModalProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const value = useMemo(() => ({ visible, setVisible }), [visible]);
  return (
    <WalletModalCtx.Provider value={value}>
      {children}
      {visible && <WalletModal onClose={() => setVisible(false)} />}
    </WalletModalCtx.Provider>
  );
}

function WalletModal({ onClose }: { onClose: () => void }) {
  const { wallets, select, connecting, connected } = useWallet();

  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Auto-close once wallet finishes connecting.
  useEffect(() => { if (connected) onClose(); }, [connected, onClose]);

  const sorted = useMemo(() => {
    const rank = (w: Wallet) =>
      w.readyState === WalletReadyState.Installed ? 0 :
      w.readyState === WalletReadyState.Loadable ? 1 :
      w.readyState === WalletReadyState.NotDetected ? 2 : 3;
    return [...wallets].sort((a, b) => rank(a) - rank(b));
  }, [wallets]);

  const handlePick = useCallback((w: Wallet) => {
    if (w.readyState === WalletReadyState.NotDetected || w.readyState === WalletReadyState.Unsupported) {
      window.open(w.adapter.url, '_blank', 'noopener,noreferrer');
      return;
    }
    select(w.adapter.name);
  }, [select]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'color-mix(in oklch, var(--bg) 60%, oklch(0 0 0 / 0.5))',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        animation: 'fade-up 0.2s var(--ease)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420,
          background: 'var(--bg-elev)',
          border: '1px solid var(--hairline)',
          borderRadius: 18,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          animation: 'fade-up 0.25s var(--ease)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 22px 16px',
          borderBottom: '1px solid var(--hairline)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500, letterSpacing: '-0.015em' }}>Connect a wallet</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
              Sign missions and approve spend on Solana.
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'transparent', border: '1px solid var(--hairline)',
              color: 'var(--text-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, lineHeight: 1, flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Wallet list */}
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sorted.length === 0 && (
            <div style={{
              padding: '20px 12px', textAlign: 'center',
              fontSize: 13, color: 'var(--text-muted)',
            }}>
              No Solana wallets configured.
            </div>
          )}
          {sorted.map((w) => {
            const detected = w.readyState === WalletReadyState.Installed;
            const loadable = w.readyState === WalletReadyState.Loadable;
            const installable = w.readyState === WalletReadyState.NotDetected;
            return (
              <button
                key={w.adapter.name}
                onClick={() => handlePick(w)}
                disabled={connecting}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 12,
                  background: 'var(--surface)',
                  border: '1px solid var(--hairline)',
                  color: 'var(--text)', cursor: connecting ? 'wait' : 'pointer',
                  textAlign: 'left', width: '100%',
                  transition: 'all 0.15s var(--ease)',
                  opacity: connecting ? 0.6 : 1,
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
                {w.adapter.icon ? (
                  <img
                    src={w.adapter.icon}
                    alt=""
                    width={28} height={28}
                    style={{ borderRadius: 7, flexShrink: 0 }}
                  />
                ) : (
                  <div style={{
                    width: 28, height: 28, borderRadius: 7,
                    background: 'var(--surface-2)', flexShrink: 0,
                  }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, letterSpacing: '-0.01em' }}>
                    {w.adapter.name}
                  </div>
                  <div style={{
                    fontSize: 11, marginTop: 2,
                    color: detected ? 'var(--ok)' : 'var(--text-dim)',
                  }}>
                    {detected ? 'Detected' : loadable ? 'Available' : installable ? 'Not installed' : 'Unsupported'}
                  </div>
                </div>
                <span style={{
                  fontSize: 11, color: 'var(--text-dim)',
                  padding: '3px 8px', borderRadius: 6,
                  background: 'var(--surface-2)', border: '1px solid var(--hairline)',
                }}>
                  {detected || loadable ? 'Connect' : 'Install ↗'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 22px 18px',
          borderTop: '1px solid var(--hairline)',
          fontSize: 11.5, color: 'var(--text-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <span>Devnet · ed25519 auth</span>
          <a
            href="https://docs.solana.com/wallet-guide"
            target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
          >
            New to Solana? ↗
          </a>
        </div>
      </div>
    </div>
  );
}
