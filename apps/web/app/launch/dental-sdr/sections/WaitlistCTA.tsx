'use client';

import { forwardRef, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import styles from "../styles.module.css";
import type { LaunchWaitlistCTA as LaunchWaitlistCTAType } from "../types";
import Reveal from "@/components/Reveal";

interface Props {
  cta: LaunchWaitlistCTAType;
  missionId?: string;
}

const WaitlistCTA = forwardRef<HTMLDivElement, Props>(function WaitlistCTA(
  { cta, missionId },
  ref,
) {
  const [email, setEmail] = useState("");
  const [practice, setPractice] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.includes("@")) {
      setErrorMsg("Use a real email.");
      setState("error");
      return;
    }
    setState("submitting");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/launch/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          practiceName: practice || undefined,
          source: "dental-sdr-landing",
          missionId,
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      setState("success");
    } catch (err) {
      try {
        const stored = JSON.parse(localStorage.getItem("dental-sdr-waitlist") ?? "[]") as unknown[];
        stored.push({ email, practiceName: practice, ts: Date.now() });
        localStorage.setItem("dental-sdr-waitlist", JSON.stringify(stored));
        setState("success");
      } catch {
        setErrorMsg("Could not submit — try again.");
        setState("error");
      }
    }
  };

  return (
    <section className={styles.section} id="waitlist" ref={ref}>
      <div className={styles.container}>
        <Reveal className={`${styles.glassStrong} ${styles.waitlistCard}`}>
          <span className={styles.eyebrow}>Pilot — first 50 practices</span>
          <h2 className={styles.waitlistTitle}>{cta.title}</h2>
          <p className={styles.waitlistSub}>{cta.sub}</p>
          {state === "success" ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className={styles.waitlistSuccess}
            >
              You're on the list. We'll reach out within 48 hours.
            </motion.div>
          ) : (
            <form
              className={styles.waitlistForm}
              data-bifrost="waitlist"
              onSubmit={submit}
              noValidate
            >
              <input
                className={styles.waitlistInput}
                type="email"
                placeholder="you@your-practice.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-label="Email address"
              />
              <input
                className={styles.waitlistInput}
                type="text"
                placeholder="Practice name (optional)"
                value={practice}
                onChange={(e) => setPractice(e.target.value)}
                aria-label="Practice name"
                style={{ flex: "1 1 100%" }}
              />
              <button
                type="submit"
                className={`${styles.cta} ${styles.ctaPrimary}`}
                disabled={state === "submitting"}
                style={{ flex: "1 1 100%", justifyContent: "center" }}
              >
                {state === "submitting" ? "Adding…" : "Join the waitlist"}
                <span aria-hidden="true">→</span>
              </button>
            </form>
          )}
          {errorMsg && state === "error" && (
            <span className={styles.waitlistError}>{errorMsg}</span>
          )}
        </Reveal>
      </div>
    </section>
  );
});

export default WaitlistCTA;
