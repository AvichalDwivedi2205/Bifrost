'use client';

import { motion, useScroll, useTransform } from "framer-motion";
import styles from "../styles.module.css";

interface TopNavProps {
  onWaitlistClick: () => void;
  missionId?: string;
}

export default function TopNav({ onWaitlistClick, missionId }: TopNavProps) {
  const { scrollY } = useScroll();
  const blur = useTransform(scrollY, [0, 80], [0, 20]);
  const bg = useTransform(scrollY, [0, 80], ["rgba(255, 248, 232, 0)", "rgba(255, 248, 232, 0.7)"]);
  const border = useTransform(
    scrollY,
    [0, 80],
    ["rgba(255, 220, 150, 0)", "rgba(255, 220, 150, 0.35)"],
  );

  return (
    <motion.nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: useTransform(blur, (v) => `blur(${v}px) saturate(1.4)`),
        WebkitBackdropFilter: useTransform(blur, (v) => `blur(${v}px) saturate(1.4)`),
        background: bg,
        borderBottom: useTransform(border, (b) => `1px solid ${b}`),
        transition: "all 0.3s ease",
      }}
    >
      <div
        className={styles.container}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 28px",
        }}
      >
        <a
          href="/launch/dental-sdr"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "linear-gradient(135deg, #d99427, #ecae50)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 6px 16px -6px rgba(217,148,39,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontFamily: "var(--font-display)",
              fontWeight: 500,
              fontSize: 15,
            }}
          >
            ƒ
          </span>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 18,
              color: "#1c160d",
              letterSpacing: "-0.01em",
              fontWeight: 420,
            }}
          >
            Dental SDR
          </span>
          {missionId && (
            <span className={styles.mono} style={{ color: "var(--amber-700)", marginLeft: 8 }}>
              · mission {missionId.slice(0, 8)}
            </span>
          )}
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <a
            href="#features"
            className={styles.mono}
            style={{ color: "#3a2f1f", textDecoration: "none" }}
          >
            Features
          </a>
          <a
            href="#pricing"
            className={styles.mono}
            style={{ color: "#3a2f1f", textDecoration: "none" }}
          >
            Pricing
          </a>
          <a
            href="#faq"
            className={styles.mono}
            style={{ color: "#3a2f1f", textDecoration: "none" }}
          >
            FAQ
          </a>
          <button
            type="button"
            onClick={onWaitlistClick}
            className={`${styles.cta} ${styles.ctaPrimary}`}
            style={{ padding: "10px 18px", fontSize: 13 }}
          >
            Join waitlist
          </button>
        </div>
      </div>
    </motion.nav>
  );
}
