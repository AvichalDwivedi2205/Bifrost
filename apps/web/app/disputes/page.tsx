'use client';

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { MissionRecord } from "@bifrost/shared";
import { listMissions, rebuildMission } from "@/lib/api";

type Tab = "open" | "resolved";

const PALETTE = {
  paper: "#fbf6ec",
  ink: "#1c160d",
  inkSoft: "#3a2f1f",
  inkMute: "#6b5d44",
  amber500: "#d99427",
  amber700: "#8a5b14",
  glass: "rgba(255, 248, 232, 0.78)",
  glassStroke: "rgba(217, 148, 39, 0.32)",
  danger: "#b04a2c",
  ok: "#3f7d3f",
};

function classifyMission(m: MissionRecord): Tab | null {
  if (m.status === "failed") return "open";
  const wasRejected = m.events?.some((e) => e.type === "VERIFICATION_REJECTED");
  if (wasRejected) return "resolved";
  return null;
}

export default function DisputesPage() {
  const [missions, setMissions] = useState<MissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("open");
  const [rebuildingId, setRebuildingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await listMissions();
      setMissions(all);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load missions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const open = missions.filter((m) => classifyMission(m) === "open");
  const resolved = missions.filter((m) => classifyMission(m) === "resolved");
  const list = tab === "open" ? open : resolved;

  async function handleRebuild(missionId: string) {
    setRebuildingId(missionId);
    setError(null);
    try {
      await rebuildMission(missionId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rebuild failed");
    } finally {
      setRebuildingId(null);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: PALETTE.paper,
        color: PALETTE.ink,
        fontFamily:
          "var(--font-body, Inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: "48px 32px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: PALETTE.amber700,
                fontFamily: "var(--font-mono-launch, JetBrains Mono), monospace",
                marginBottom: 8,
              }}
            >
              Verifier ledger
            </div>
            <h1
              style={{
                fontFamily: "var(--font-display, Fraunces), serif",
                fontSize: 44,
                fontWeight: 400,
                letterSpacing: "-0.025em",
                margin: 0,
              }}
            >
              Disputes
            </h1>
            <p style={{ color: PALETTE.inkMute, fontSize: 15, marginTop: 8, maxWidth: 640 }}>
              Missions where the verifier rejected a deliverable. Operator can trigger a free rebuild;
              second pass overwrites the previous verification record on settlement.
            </p>
          </div>
          <Link
            href="/missions"
            style={{
              fontFamily: "var(--font-mono-launch, JetBrains Mono), monospace",
              fontSize: 12,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: PALETTE.amber700,
              textDecoration: "none",
              padding: "8px 14px",
              border: `1px solid ${PALETTE.glassStroke}`,
              borderRadius: 999,
              background: "rgba(217, 148, 39, 0.08)",
            }}
          >
            ← Mission list
          </Link>
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
          {(["open", "resolved"] as Tab[]).map((t) => {
            const active = t === tab;
            const count = t === "open" ? open.length : resolved.length;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  padding: "10px 18px",
                  borderRadius: 12,
                  border: active
                    ? `1px solid ${PALETTE.amber500}`
                    : `1px solid ${PALETTE.glassStroke}`,
                  background: active ? "rgba(217, 148, 39, 0.16)" : "rgba(255, 248, 232, 0.4)",
                  color: active ? PALETTE.amber700 : PALETTE.inkSoft,
                  fontFamily: "var(--font-mono-launch, JetBrains Mono), monospace",
                  fontSize: 12,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  fontWeight: active ? 600 : 500,
                }}
              >
                {t === "open" ? "Open" : "Resolved"} ({count})
              </button>
            );
          })}
        </div>

        {error ? (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              background: "rgba(176, 74, 44, 0.08)",
              border: `1px solid rgba(176, 74, 44, 0.32)`,
              color: PALETTE.danger,
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        ) : null}

        {loading ? (
          <div style={{ color: PALETTE.inkMute, padding: "32px 0" }}>Loading missions…</div>
        ) : list.length === 0 ? (
          <div
            style={{
              padding: "48px 32px",
              borderRadius: 18,
              border: `1px solid ${PALETTE.glassStroke}`,
              background: PALETTE.glass,
              textAlign: "center",
              color: PALETTE.inkMute,
              fontSize: 15,
            }}
          >
            {tab === "open" ? "No open disputes." : "No resolved disputes yet."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {list.map((mission) => (
              <DisputeCard
                key={mission.id}
                mission={mission}
                rebuildable={tab === "open"}
                onRebuild={() => handleRebuild(mission.id)}
                rebuilding={rebuildingId === mission.id}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function DisputeCard({
  mission,
  rebuildable,
  onRebuild,
  rebuilding,
}: {
  mission: MissionRecord;
  rebuildable: boolean;
  onRebuild: () => void;
  rebuilding: boolean;
}) {
  const reason =
    mission.failureReason ??
    mission.events?.find((e) => e.type === "VERIFICATION_REJECTED")?.label ??
    "Verifier rejection recorded";
  const failedChecks = mission.verificationChecks?.filter((c) => c.status === "failed") ?? [];

  return (
    <div
      style={{
        padding: "20px 24px",
        borderRadius: 18,
        border: `1px solid ${PALETTE.glassStroke}`,
        background: PALETTE.glass,
        backdropFilter: "blur(12px)",
        boxShadow: "0 18px 40px -24px rgba(120, 80, 10, 0.25)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontFamily: "var(--font-mono-launch, JetBrains Mono), monospace",
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: PALETTE.amber700,
              marginBottom: 4,
            }}
          >
            {mission.id} · {mission.input.template ?? "mission"}
          </div>
          <div
            style={{
              fontFamily: "var(--font-display, Fraunces), serif",
              fontSize: 22,
              fontWeight: 400,
              letterSpacing: "-0.02em",
              marginBottom: 6,
            }}
          >
            {mission.input.title || mission.input.objective?.slice(0, 80) || "(untitled mission)"}
          </div>
          <div style={{ color: PALETTE.danger, fontSize: 13, marginBottom: 8 }}>{reason}</div>
          {failedChecks.length > 0 ? (
            <ul style={{ margin: 0, padding: "0 0 0 18px", color: PALETTE.inkSoft, fontSize: 13 }}>
              {failedChecks.map((c) => (
                <li key={c.id} style={{ marginBottom: 2 }}>
                  <strong>{c.label}</strong>
                  {c.detail ? ` — ${c.detail}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
          <Link
            href={`/missions/${mission.id}`}
            style={{
              fontSize: 12,
              fontFamily: "var(--font-mono-launch, JetBrains Mono), monospace",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: PALETTE.amber700,
              textDecoration: "none",
              padding: "6px 12px",
              border: `1px solid ${PALETTE.glassStroke}`,
              borderRadius: 999,
              background: "rgba(217, 148, 39, 0.08)",
            }}
          >
            Open cockpit →
          </Link>
          {rebuildable ? (
            <button
              type="button"
              onClick={onRebuild}
              disabled={rebuilding}
              style={{
                padding: "10px 18px",
                background: rebuilding ? "rgba(28, 22, 13, 0.4)" : PALETTE.ink,
                color: PALETTE.paper,
                border: "none",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "var(--font-body, Inter), sans-serif",
                cursor: rebuilding ? "wait" : "pointer",
                letterSpacing: "-0.005em",
                boxShadow: "0 12px 28px -12px rgba(28, 22, 13, 0.55)",
              }}
            >
              {rebuilding ? "Rebuilding…" : "Rebuild (free)"}
            </button>
          ) : (
            <span
              style={{
                fontFamily: "var(--font-mono-launch, JetBrains Mono), monospace",
                fontSize: 11,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: PALETTE.ok,
              }}
            >
              Resolved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
