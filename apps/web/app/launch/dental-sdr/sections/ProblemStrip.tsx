'use client';

import styles from "../styles.module.css";
import type { LaunchProblem } from "../types";
import CountUp from "@/components/launch/CountUp";
import Reveal from "@/components/Reveal";

export default function ProblemStrip({ problem }: { problem: LaunchProblem }) {
  return (
    <section className={styles.section} id="problem">
      <div className={styles.container}>
        <Reveal>
          <span className={styles.eyebrow}>The math</span>
          <h2 className={styles.sectionTitle}>{problem.title}</h2>
        </Reveal>
        <div className={styles.problemGrid}>
          {problem.stats.map((stat, idx) => (
            <Reveal
              key={stat.label}
              delay={idx * 0.08}
              className={`${styles.glass} ${styles.problemCard} ${styles.lift}`}
            >
              <CountUp className={styles.problemValue} value={stat.value} />
              <div className={styles.problemLabel}>{stat.label}</div>
              <div className={styles.problemFootnote}>{stat.footnote}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
