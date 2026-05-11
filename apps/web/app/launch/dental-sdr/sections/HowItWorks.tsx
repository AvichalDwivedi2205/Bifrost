'use client';

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import styles from "../styles.module.css";
import type { LaunchHowItWorks } from "../types";
import Reveal from "@/components/Reveal";

export default function HowItWorks({ howItWorks }: { howItWorks: LaunchHowItWorks }) {
  const wrapRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: wrapRef, offset: ["start start", "end end"] });
  const x = useTransform(
    scrollYProgress,
    [0, 1],
    ["0vw", `-${(howItWorks.frames.length - 1) * 65}vw`],
  );

  return (
    <section ref={wrapRef} className={styles.howWrap} id="how-it-works">
      <div className={styles.howSticky}>
        <div style={{ position: "absolute", top: 56, left: 0, right: 0 }}>
          <div className={styles.container}>
            <Reveal>
              <span className={styles.eyebrow}>How it works</span>
              <h2 className={styles.sectionTitle}>{howItWorks.title}</h2>
              <p className={styles.sectionSubtitle}>{howItWorks.subtitle}</p>
            </Reveal>
          </div>
        </div>
        <motion.div className={styles.howScroller} style={{ x }}>
          {howItWorks.frames.map((frame, idx) => (
            <div
              key={frame.label}
              className={`${styles.glass} ${styles.howFrame}`}
            >
              <div className={styles.howFrameText}>
                <span className={styles.howFrameIndex}>
                  0{idx + 1} / 0{howItWorks.frames.length}
                </span>
                <div>
                  <h3 className={styles.howFrameLabel}>{frame.label}</h3>
                  <p className={styles.howFrameBody}>{frame.body}</p>
                </div>
              </div>
              {frame.image ? (
                <div className={styles.howFrameImage}>
                  <img src={frame.image} alt={frame.label} loading="lazy" />
                </div>
              ) : null}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
