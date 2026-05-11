'use client';

import dynamic from "next/dynamic";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import styles from "../styles.module.css";
import type { LaunchHero } from "../types";

const HeroScene = dynamic(() => import("@/components/launch/HeroScene"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(circle at 70% 35%, #fbe9c0 0%, #fbf6ec 60%)",
        opacity: 0.7,
      }}
    />
  ),
});

interface HeroProps {
  hero: LaunchHero;
  onWaitlistClick: () => void;
}

export default function Hero({ hero, onWaitlistClick }: HeroProps) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const sceneY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section ref={ref} className={styles.heroWrap}>
      <motion.div className={styles.heroSceneLayer} style={{ y: sceneY }}>
        <HeroScene />
      </motion.div>
      {hero.sideImage ? (
        <motion.div
          className={styles.heroImageCard}
          style={{ y: sceneY }}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.0, delay: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <img src={hero.sideImage} alt="Dental practice" loading="eager" />
        </motion.div>
      ) : null}
      <div className={styles.container}>
        <motion.div className={styles.heroContent} style={{ y: contentY, opacity: contentOpacity }}>
          <motion.span
            className={styles.eyebrow}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {hero.eyebrow}
          </motion.span>
          <motion.h1
            className={styles.heroHeadline}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {hero.h1.split("manage").map((part, idx, arr) =>
              idx === 0 && arr.length > 1 ? (
                <span key={idx}>
                  {part}
                  <em>manage</em>
                </span>
              ) : (
                <span key={idx}>{part}</span>
              ),
            )}
          </motion.h1>
          <motion.p
            className={styles.heroSub}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {hero.sub}
          </motion.p>
          <motion.div
            className={styles.heroCTAs}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.34, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <button
              type="button"
              className={`${styles.cta} ${styles.ctaPrimary}`}
              onClick={onWaitlistClick}
            >
              {hero.ctaPrimary}
              <span aria-hidden="true">→</span>
            </button>
            <a className={`${styles.cta} ${styles.ctaSecondary}`} href="#how-it-works">
              {hero.ctaSecondary}
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
