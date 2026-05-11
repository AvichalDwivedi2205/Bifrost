'use client';

import { useRef } from "react";
import LenisProvider from "./LenisProvider";
import styles from "./styles.module.css";
import type { LaunchPageContent } from "./types";
import TopNav from "./sections/TopNav";
import Hero from "./sections/Hero";
import ProblemStrip from "./sections/ProblemStrip";
import HowItWorks from "./sections/HowItWorks";
import FeatureGrid from "./sections/FeatureGrid";
import QuoteMarquee from "./sections/QuoteMarquee";
import Pricing from "./sections/Pricing";
import FAQ from "./sections/FAQ";
import WaitlistCTA from "./sections/WaitlistCTA";
import Footer from "./sections/Footer";

interface Props {
  content: LaunchPageContent;
  missionId?: string;
}

export default function LaunchPageClient({ content, missionId }: Props) {
  const waitlistRef = useRef<HTMLDivElement>(null);
  const scrollToWaitlist = () => {
    waitlistRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <LenisProvider>
      <main className={styles.root}>
        <TopNav onWaitlistClick={scrollToWaitlist} missionId={missionId} />
        <Hero hero={content.hero} onWaitlistClick={scrollToWaitlist} />
        <ProblemStrip problem={content.problem} />
        <HowItWorks howItWorks={content.howItWorks} />
        <FeatureGrid features={content.features} />
        <QuoteMarquee testimonials={content.testimonials} />
        <Pricing tiers={content.pricing} onSelect={scrollToWaitlist} />
        <FAQ items={content.faq} />
        <WaitlistCTA ref={waitlistRef} cta={content.waitlistCTA} missionId={missionId} />
        <Footer />
      </main>
    </LenisProvider>
  );
}
