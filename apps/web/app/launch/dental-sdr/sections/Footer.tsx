'use client';

import styles from "../styles.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.footerInner}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 360 }}>
            <a href="/" className={styles.footerBadge}>
              Built by Bifrost · Governed on Solana
            </a>
            <p style={{ fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.55 }}>
              Every spend, every approval, every artifact — signed and anchored. Open audit trail
              for every mission run.
            </p>
          </div>
          <div className={styles.footerLinks}>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
            <a href="#waitlist">Waitlist</a>
            <a href="/missions">Cockpit</a>
            <a href="/agents">Agents</a>
          </div>
        </div>
        <div className={styles.divider} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            fontSize: 12,
            color: "var(--ink-mute)",
          }}
        >
          <span>© 2026 — Dental AI SDR. Built in 48 hours by Bifrost agents.</span>
          <span>Privacy · Terms · BAA on request</span>
        </div>
      </div>
    </footer>
  );
}
