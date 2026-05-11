'use client';

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import styles from "../styles.module.css";
import type { LaunchFAQItem } from "../types";
import Reveal from "@/components/Reveal";

export default function FAQ({ items }: { items: LaunchFAQItem[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <section className={styles.section} id="faq">
      <div className={styles.container}>
        <Reveal>
          <span className={styles.eyebrow}>Questions</span>
          <h2 className={styles.sectionTitle}>What practices ask first.</h2>
        </Reveal>
        <div className={styles.faqList}>
          {items.map((item, idx) => {
            const open = openIdx === idx;
            return (
              <Reveal key={item.q} delay={idx * 0.04} className={styles.faqItem}>
                <button
                  type="button"
                  className={styles.faqQuestion}
                  aria-expanded={open}
                  onClick={() => setOpenIdx(open ? null : idx)}
                >
                  {item.q}
                  <span className={styles.faqIcon} aria-hidden="true">
                    +
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                      style={{ overflow: "hidden" }}
                    >
                      <div className={styles.faqAnswer}>{item.a}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
