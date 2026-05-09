'use client';
import React from 'react';
import type { SpendApprovalRequest } from '@bifrost/shared';
import SlideOver from './SlideOver';
import { PaymentRequestCard } from '../../PaymentRequestCard';

export interface SpendSlideOverProps {
  open: boolean;
  onClose: () => void;
  approval: SpendApprovalRequest | undefined;
  onDecision: (approval: SpendApprovalRequest, approve: boolean) => Promise<void> | void;
  pending: boolean;
}

export default function SpendSlideOver({ open, onClose, approval, onDecision, pending }: SpendSlideOverProps) {
  if (!approval) {
    return <SlideOver open={open} onClose={onClose} title="Payment request" subtitle="Loading…" />;
  }
  return (
    <SlideOver open={open} onClose={onClose} title="Payment request" subtitle="Review and approve or reject">
      <PaymentRequestCard
        request={{
          approvalId: approval.id,
          agentId: approval.agentId,
          amount: approval.amount,
          service: approval.service,
          justification: approval.justification,
          requestedAt: approval.requestedAt,
        }}
        isApproving={pending}
        isRejecting={pending}
        onApprove={() => onDecision(approval, true)}
        onReject={() => onDecision(approval, false)}
      />
    </SlideOver>
  );
}
