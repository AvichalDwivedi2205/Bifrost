'use client';
import React from 'react';
import BubbleShell from './BubbleShell';

export default function RebuildBubble() {
  return (
    <BubbleShell
      side="left"
      tone="bifrost"
      title="Rebuild"
      subtitle="Second pass · 0 SOL spent · agents resumed from task-build"
      avatar={<span aria-hidden>↻</span>}
      width="min(640px, 100%)"
    >
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        Builder regenerates the failed artifact, deployer reuses the preview receipt, verifier re-runs the same rule
        set. Settlement will record both passes in one atomic transaction.
      </div>
    </BubbleShell>
  );
}
