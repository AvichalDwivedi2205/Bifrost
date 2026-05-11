'use client';

import { useState } from "react";

interface PreviewFrameProps {
  url: string | null | undefined;
  missionId: string;
  label?: string;
}

export default function PreviewFrame({ url, missionId, label = "Preview" }: PreviewFrameProps) {
  const [open, setOpen] = useState(false);
  const resolvedUrl = (() => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    if (url.startsWith("/")) return url;
    return `/${url}`;
  })();

  return (
    <div
      style={{
        border: "1px solid var(--hairline)",
        borderRadius: 14,
        background: "var(--surface)",
        overflow: "hidden",
        marginTop: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: "1px solid var(--hairline)",
          background: "var(--surface-2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <span style={{ color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {label}
          </span>
          {resolvedUrl ? (
            <span className="mono" style={{ color: "var(--accent)", fontSize: 11 }}>
              {resolvedUrl.length > 56 ? `${resolvedUrl.slice(0, 56)}…` : resolvedUrl}
            </span>
          ) : (
            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>pending build</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {resolvedUrl && (
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 7,
                border: "1px solid var(--hairline)",
                background: "var(--surface)",
                color: "var(--text)",
                cursor: "pointer",
              }}
            >
              {open ? "Collapse" : "Embed"}
            </button>
          )}
          {resolvedUrl && (
            <a
              href={`/launch/dental-sdr?missionId=${encodeURIComponent(missionId)}`}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 7,
                border: "1px solid var(--accent)",
                color: "var(--accent)",
                textDecoration: "none",
              }}
            >
              Open ↗
            </a>
          )}
        </div>
      </div>
      {open && resolvedUrl && (
        <div style={{ height: 520, background: "#fbf6ec", position: "relative" }}>
          <iframe
            src={`/launch/dental-sdr?missionId=${encodeURIComponent(missionId)}`}
            title={`${label} for mission ${missionId}`}
            sandbox="allow-scripts allow-same-origin allow-forms"
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          />
        </div>
      )}
    </div>
  );
}
