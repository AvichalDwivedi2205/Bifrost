'use client';

import styles from "../styles.module.css";
import type { LaunchTestimonial } from "../types";
import Reveal from "@/components/Reveal";

export default function QuoteMarquee({ testimonials }: { testimonials: LaunchTestimonial[] }) {
  const doubled = [...testimonials, ...testimonials];
  return (
    <section className={styles.section} id="testimonials">
      <div className={styles.container}>
        <Reveal>
          <span className={styles.eyebrow}>From the chair</span>
          <h2 className={styles.sectionTitle}>What dentists say after the first week.</h2>
        </Reveal>
      </div>
      <div className={styles.marqueeWrap}>
        <div className={styles.marqueeTrack}>
          {doubled.map((t, idx) => (
            <div key={`${t.author}-${idx}`} className={`${styles.glass} ${styles.quoteCard}`}>
              <p className={styles.quoteBody}>“{t.quote}”</p>
              <div className={styles.quoteMeta}>
                {t.avatar ? (
                  <span className={styles.quoteAvatar}>
                    <img src={t.avatar} alt={t.author} loading="lazy" />
                  </span>
                ) : null}
                <span className={styles.quoteMetaText}>
                  <span className={styles.quoteAuthor}>{t.author}</span>
                  <span>{t.location}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
