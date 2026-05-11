

export const STATUS_TONE: Record<string, string> = {
  running: 'pending', settled: 'ok', failed: 'danger', pending: 'warn',
  verifying: 'pending', selection_pending: 'warn', queued: 'default', probation: 'warn',
};

export function fmtUsdc(n: number) { return `${n.toFixed(2)} USDC`; }
export function fmtPct(n: number) { return `${n.toFixed(0)}%`; }
