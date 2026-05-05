'use client';

export interface VerificationCheckRowProps {
  label: string;
  passed: boolean;
  detail?: string;
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" style={{ color }}>
      <path d="M2 7L5.5 11L12 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" style={{ color }}>
      <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function VerificationCheckRow({
  label,
  passed,
  detail,
}: VerificationCheckRowProps) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: detail ? 8 : 0 }}>
      {passed ? (
        <CheckIcon color="var(--ok)" />
      ) : (
        <XIcon color="var(--danger)" />
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>
          {label}
        </div>
        {detail && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}

export default VerificationCheckRow;
