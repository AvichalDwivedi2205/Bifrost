'use client';

import type { CSSProperties } from "react";

interface TxLinkProps {
  signature: string | null | undefined;
  cluster?: "devnet" | "mainnet-beta" | "testnet" | "custom";
  customUrl?: string;
  short?: boolean;
  label?: string;
  style?: CSSProperties;
  /** "tx" links to /tx/<sig>; "address" links to /address/<addr> (PDAs, vaults). Default "tx". */
  kind?: "tx" | "address";
}

export default function TxLink({
  signature,
  cluster = "devnet",
  customUrl,
  short = true,
  label,
  style,
  kind = "tx",
}: TxLinkProps) {
  if (!signature) {
    return (
      <span className="mono" style={{ color: "var(--text-dim)", fontSize: 11, ...style }}>
        no tx
      </span>
    );
  }
  const isMockId =
    signature.startsWith("tx_") ||
    signature.startsWith("rep_") ||
    signature.startsWith("vault_") ||
    signature.startsWith("settle_") ||
    signature.startsWith("prepare_") ||
    signature === "create_or_reused" ||
    signature === "allocation_ready" ||
    signature.length < 32;
  const display = short && signature.length > 16 ? `${signature.slice(0, 8)}…${signature.slice(-6)}` : signature;
  if (isMockId || cluster === "custom") {
    return (
      <span className="mono" style={{ color: "var(--text-muted)", fontSize: 11, ...style }} title={signature}>
        {label ? `${label}: ` : ""}
        {display}
      </span>
    );
  }
  const url =
    customUrl ??
    `https://explorer.solana.com/${kind === "address" ? "address" : "tx"}/${signature}?cluster=${cluster}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mono"
      title={signature}
      style={{
        color: "var(--accent)",
        fontSize: 11,
        textDecoration: "none",
        borderBottom: "1px dashed var(--accent)",
        ...style,
      }}
    >
      {label ? `${label}: ` : ""}
      {display} ↗
    </a>
  );
}
