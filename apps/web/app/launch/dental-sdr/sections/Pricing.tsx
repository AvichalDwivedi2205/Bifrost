'use client';

import styles from "../styles.module.css";
import type { LaunchPricingTier } from "../types";
import Reveal from "@/components/Reveal";

export default function Pricing({
  tiers,
  onSelect,
}: {
  tiers: LaunchPricingTier[];
  onSelect: () => void;
}) {
  return (
    <section className={styles.section} id="pricing">
      <div className={styles.container}>
        <Reveal>
          <span className={styles.eyebrow}>Pricing</span>
          <h2 className={styles.sectionTitle}>Per location. Per month. No surprises.</h2>
          <p className={styles.sectionSubtitle}>
            Pause for slow months. Cancel anytime. Pilots get founder pricing.
          </p>
        </Reveal>
        <div className={styles.pricingGrid}>
          {tiers.map((tier, idx) => (
            <Reveal
              key={tier.tier}
              delay={idx * 0.08}
              className={`${styles.glass} ${styles.pricingCard} ${
                tier.highlight ? styles.pricingHighlight : ""
              }`}
            >
              <div>
                <div className={styles.pricingTier}>{tier.tier}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12 }}>
                  <span className={styles.pricingPrice}>{tier.price}</span>
                  <span className={styles.pricingCadence}>{tier.cadence}</span>
                </div>
              </div>
              <ul className={styles.pricingFeatures}>
                {tier.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <button
                type="button"
                className={`${styles.cta} ${tier.highlight ? styles.ctaPrimary : styles.ctaSecondary}`}
                onClick={onSelect}
                style={{ width: "100%", justifyContent: "center" }}
              >
                {tier.tier === "DSO" ? "Talk to founders" : "Join waitlist"}
              </button>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
