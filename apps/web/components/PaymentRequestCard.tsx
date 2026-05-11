'use client';
import React, { useState } from 'react';
import type { PolicyCheckResult } from '@bifrost/shared';
import { Card, Btn, Pill, WalletAddr } from './ui/primitives';
import { AgentIcon } from './ui/agent-icons';

export interface PaymentRequestCardProps {
  request: {
    approvalId: string;
    agentId: string;
    agentName?: string;
    agentRole?: string;
    amount: number;
    service: string;
    toolName?: string;
    payoutWallet?: string;
    justification: string;
    policyChecks?: PolicyCheckResult;
    requestedAt: string;
  };
  isApproving: boolean;
  isRejecting: boolean;
  onApprove: () => void | Promise<void>;
  onReject: () => void | Promise<void>;
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" style={{ color }}>
      <path d="M2 7L5.5 11L12 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WarningIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" style={{ color }}>
      <circle cx="7" cy="10" r="0.8" fill="currentColor" />
      <path d="M7 2v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function PaymentRequestCard({
  request,
  isApproving,
  isRejecting,
  onApprove,
  onReject,
}: PaymentRequestCardProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const [approvedFlash, setApprovedFlash] = useState(false);

  const handleApprove = async () => {
    setLocalError(null);
    try {
      await onApprove();
      setApprovedFlash(true);
      window.setTimeout(() => setApprovedFlash(false), 700);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Approval failed');
    }
  };

  const handleReject = async () => {
    setLocalError(null);
    try {
      await onReject();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Rejection failed');
    }
  };

  const isLoading = isApproving || isRejecting;
  const agentColor = request.agentRole ? getAgentColor(request.agentRole) : 'oklch(0.76 0.13 320)';

  return (
    <Card
      glow
      style={{
        padding: '18px 22px',
        borderColor: 'color-mix(in oklch, var(--accent) 40%, transparent)',
        background: 'linear-gradient(180deg, var(--surface), color-mix(in oklch, var(--plasma-2) 8%, var(--surface)))',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle plasma backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center right, var(--plasma-2) 0%, transparent 60%)',
          opacity: 0.08,
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header: Agent + Amount */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: agentColor.replace(')', ' / 0.14)'),
                color: agentColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AgentIcon role={request.agentRole as any} size={20} color={agentColor} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                {request.agentName || 'Unknown Agent'}
              </div>
              {request.agentRole && <Pill tone="accent" dot={false} style={{ marginTop: 4 }}>AGENT REQUESTING PAYMENT</Pill>}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              background: 'color-mix(in oklch, var(--accent) 12%, transparent)',
              border: '1px solid color-mix(in oklch, var(--accent) 25%, transparent)',
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--accent)',
                letterSpacing: '-0.01em',
              }}
            >
              {request.amount.toFixed(2)}
            </span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--accent)' }}>USDC</span>
          </div>
        </div>

        {/* Justification */}
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--text-muted)',
            marginBottom: 12,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {request.justification}
        </div>

        {/* Metadata: service · tool · wallet */}
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            marginBottom: 14,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span>{request.service}</span>
          {request.toolName && (
            <>
              <span style={{ color: 'var(--text-dim)' }}>·</span>
              <span>{request.toolName}</span>
            </>
          )}
          {request.payoutWallet && (
            <>
              <span style={{ color: 'var(--text-dim)' }}>·</span>
              <span>payout: <WalletAddr short={request.payoutWallet.slice(0, 4) + '…' + request.payoutWallet.slice(-5)} /></span>
            </>
          )}
        </div>

        {/* Policy Checks Grid (if provided) */}
        {request.policyChecks && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              padding: 12,
              borderRadius: 10,
              background: 'var(--surface-2)',
              border: '1px solid var(--hairline)',
              marginBottom: 14,
            }}
          >
            {/* Under max per call */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <CheckIcon color="var(--ok)" />
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                Under max-per-call
              </div>
            </div>

            {/* Service allowlisted */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <CheckIcon color="var(--ok)" />
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Service allowlisted</div>
            </div>

            {/* Human approval required */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {request.policyChecks.humanApprovalRequired ? (
                <WarningIcon color="var(--warn)" />
              ) : (
                <CheckIcon color="var(--ok)" />
              )}
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                {request.policyChecks.humanApprovalRequired ? 'Human approval required' : 'No approval threshold'}
              </div>
            </div>

            {/* Mission budget remaining */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {request.policyChecks.missionBudgetRemaining > request.amount ? (
                <CheckIcon color="var(--ok)" />
              ) : (
                <WarningIcon color="var(--danger)" />
              )}
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                Budget: {request.policyChecks.missionBudgetRemaining.toFixed(2)} USDC
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {localError && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--danger)',
              marginBottom: 12,
              padding: 8,
              borderRadius: 6,
              background: 'color-mix(in oklch, var(--danger) 8%, transparent)',
              border: '1px solid color-mix(in oklch, var(--danger) 25%, transparent)',
            }}
          >
            {localError}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <Btn
            variant="primary"
            size="sm"
            icon="check"
            disabled={isLoading}
            onClick={handleApprove}
            style={{
              opacity: isLoading ? 0.7 : 1,
              animation: approvedFlash
                ? 'ring-burst 0.7s var(--ease) forwards, ok-flash 0.7s var(--ease) forwards'
                : isApproving
                  ? undefined
                  : 'ring-pulse 1.6s ease-in-out infinite',
              borderRadius: 10,
            }}
          >
            {isApproving ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'white',
                    animation: 'pulse-soft 1s infinite',
                  }}
                />
                Approving
              </span>
            ) : (
              'Approve & Sign'
            )}
          </Btn>
          <Btn
            variant="ghost"
            size="sm"
            icon="x"
            disabled={isLoading}
            onClick={handleReject}
            style={{
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isRejecting ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'currentColor',
                    animation: 'pulse-soft 1s infinite',
                  }}
                />
                Rejecting
              </span>
            ) : (
              'Reject'
            )}
          </Btn>
        </div>

        {/* Wallet hint */}
        <div style={{ fontSize: 10.5, color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.4 }}>
          Phantom will prompt to sign
        </div>
      </div>
    </Card>
  );
}

function getAgentColor(role?: string): string {
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
  return ROLE_COLORS[role ?? ''] || 'oklch(0.76 0.13 320)';
}
