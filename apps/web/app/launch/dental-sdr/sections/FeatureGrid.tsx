'use client';

import styles from "../styles.module.css";
import type { LaunchFeature } from "../types";
import Reveal from "@/components/Reveal";

const ICONS = [
  // PMS plug
  <svg key="plug" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 2v4M15 2v4M7 6h10v6a5 5 0 0 1-10 0V6zM12 17v5" />
  </svg>,
  // Shield
  <svg key="shield" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>,
  // Channels
  <svg key="channels" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5h16v10H8l-4 4V5z" />
    <path d="M8 9h8M8 12h5" />
  </svg>,
  // Globe
  <svg key="globe" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </svg>,
  // Calendar
  <svg key="cal" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 3v4M16 3v4M9 14l2 2 4-4" />
  </svg>,
  // Refresh
  <svg key="refresh" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 4v4h-4M21 12a9 9 0 0 1-15 6.7L3 16M3 20v-4h4" />
  </svg>,
];

export default function FeatureGrid({ features }: { features: LaunchFeature[] }) {
  return (
    <section className={styles.section} id="features">
      <div className={styles.container}>
        <Reveal>
          <span className={styles.eyebrow}>Capabilities</span>
          <h2 className={styles.sectionTitle}>Everything your front desk wishes it had.</h2>
          <p className={styles.sectionSubtitle}>
            Built for dental practices first. Not retrofitted from a generic SaaS.
          </p>
        </Reveal>
        <div className={styles.featureGrid}>
          {features.map((feature, idx) => (
            <Reveal
              key={feature.title}
              delay={(idx % 3) * 0.06}
              className={`${styles.glass} ${styles.featureCard} ${styles.lift}`}
            >
              <span className={styles.featureIcon}>{ICONS[idx % ICONS.length]}</span>
              <div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureBody}>{feature.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
