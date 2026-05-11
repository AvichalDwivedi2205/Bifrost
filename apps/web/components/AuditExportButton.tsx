'use client';

import { useState } from "react";
import type { MissionRecord } from "@bifrost/shared";

interface Props {
  mission: MissionRecord;
  apiBase?: string;
  label?: string;
}

type Phase = 'idle' | 'working' | 'done';

export default function AuditExportButton({ mission, apiBase, label = "Export proof bundle" }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [showToast, setShowToast] = useState(false);

  const handleExport = async () => {
    if (phase !== 'idle') return;
    setPhase('working');
    const fetched: Record<string, unknown> = {};
    if (apiBase) {
      try {
        const [messagesRes, verificationRes] = await Promise.allSettled([
          fetch(`${apiBase}/api/missions/${mission.id}/messages`).then((r) => r.json()),
          fetch(`${apiBase}/api/missions/${mission.id}/verification`).then((r) => r.json()),
        ]);
        if (messagesRes.status === "fulfilled") fetched.messages = messagesRes.value?.messages ?? [];
        if (verificationRes.status === "fulfilled") fetched.verificationReport = verificationRes.value?.report;
      } catch (err) {
        console.warn("[audit] supplemental fetch failed", err);
      }
    }
    const bundle = {
      generatedAt: new Date().toISOString(),
      schemaVersion: "bifrost.proof-bundle.v1",
      mission: {
        id: mission.id,
        status: mission.status,
        input: mission.input,
        budget: mission.budget,
        chain: mission.chain ?? null,
        settlement: mission.settlement,
        finalResult: mission.finalResult ?? null,
      },
      events: mission.events,
      tasks: mission.tasks,
      agents: mission.agents,
      humanCheckpoints: mission.humanCheckpoints,
      pendingSpendApprovals: mission.pendingSpendApprovals,
      receipts: mission.receipts,
      verificationChecks: mission.verificationChecks,
      verificationReport: mission.verificationReport ?? null,
      proof: mission.proof ?? null,
      reputationDeltas: mission.reputationDeltas,
      trustProfiles: mission.trustProfiles,
      deliverables: mission.deliverables ?? null,
      agentWork: mission.agentWork,
      ...fetched,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bifrost-mission-${mission.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    setPhase('done');
    setShowToast(true);
    window.setTimeout(() => setShowToast(false), 2400);
    window.setTimeout(() => setPhase('idle'), 1800);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleExport}
        disabled={phase === 'working'}
        style={{
          fontSize: 12,
          padding: "8px 14px",
          borderRadius: 9,
          border: "1px solid var(--accent)",
          background: phase === 'done'
            ? 'color-mix(in oklch, var(--ok) 18%, transparent)'
            : "color-mix(in oklch, var(--accent) 10%, transparent)",
          color: phase === 'done' ? 'var(--ok)' : "var(--accent)",
          cursor: phase === 'working' ? 'wait' : "pointer",
          fontWeight: 500,
          fontFamily: "var(--font-sans)",
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          minWidth: 170,
          justifyContent: 'center',
          transition: 'background 0.25s var(--ease), color 0.25s var(--ease), border-color 0.25s var(--ease)',
        }}
      >
        {phase === 'working' ? (
          <>
            <span
              aria-hidden
              style={{
                width: 12,
                height: 12,
                border: '2px solid color-mix(in oklch, var(--accent) 35%, transparent)',
                borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                animation: 'spin-slow 0.7s linear infinite',
              }}
            />
            Bundling
          </>
        ) : phase === 'done' ? (
          <>
            <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden>
              <path
                d="M5 12.5 L10 17 L19 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="32"
                strokeDashoffset="32"
                style={{ animation: 'draw-check 0.5s var(--ease) forwards' }}
              />
            </svg>
            Exported
          </>
        ) : (
          <>⬇ {label}</>
        )}
      </button>
      {showToast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            zIndex: 80,
            padding: '10px 14px',
            borderRadius: 12,
            background: 'color-mix(in oklch, var(--surface) 95%, transparent)',
            border: '1px solid var(--hairline)',
            boxShadow: 'var(--shadow-md)',
            fontSize: 12.5,
            color: 'var(--text-muted)',
            animation: 'slide-up-toast 0.32s var(--ease-spring) both',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--ok)', boxShadow: '0 0 8px var(--ok)' }} />
          Downloaded · <span className="mono" style={{ fontSize: 11.5 }}>bifrost-mission-{mission.id}.json</span>
        </div>
      )}
    </>
  );
}
