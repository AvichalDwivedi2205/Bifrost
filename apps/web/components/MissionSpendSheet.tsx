'use client';
import React, { useEffect, useRef } from 'react';
import { PaymentRequestCard } from './PaymentRequestCard';
import type { PaymentRequestCardProps } from './PaymentRequestCard';

export interface MissionSpendSheetProps extends PaymentRequestCardProps {
  open: boolean;
  onClose: () => void;
}

export function MissionSpendSheet({
  open,
  onClose,
  request,
  isApproving,
  isRejecting,
  onApprove,
  onReject,
}: MissionSpendSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus management
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Focus first button in the sheet
      const timer = setTimeout(() => {
        const firstBtn = sheetRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])');
        firstBtn?.focus();
      }, 80); // allow slide animation to settle
      return () => clearTimeout(timer);
    } else {
      previousFocusRef.current?.focus();
    }
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Wrap approve/reject to auto-close sheet on completion
  const handleApprove = async () => {
    await onApprove();
    onClose();
  };

  const handleReject = async () => {
    await onReject();
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          background: 'oklch(0.08 0.012 260 / 0.72)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Payment request"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          width: 'clamp(320px, 440px, 100vw)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-elev)',
          borderLeft: '1px solid var(--hairline)',
          boxShadow: 'var(--shadow-lg)',
          animation: 'sheet-slide-in 0.22s var(--ease) both',
          overflowY: 'auto',
        }}
      >
        {/* Sheet header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--hairline)',
          position: 'sticky',
          top: 0,
          background: 'var(--bg-elev)',
          zIndex: 1,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Payment Request</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>Review and approve or reject</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close payment request"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid var(--hairline)',
              background: 'var(--surface)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; }}
          >
            ×
          </button>
        </div>

        {/* Sheet body */}
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
          <PaymentRequestCard
            request={request}
            isApproving={isApproving}
            isRejecting={isRejecting}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </div>
      </div>

      <style>{`
        @keyframes sheet-slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes sheet-slide-in {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
        }
      `}</style>
    </>
  );
}

export default MissionSpendSheet;
