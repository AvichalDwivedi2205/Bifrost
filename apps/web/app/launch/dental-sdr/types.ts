export interface LaunchPositioning {
  positioning: "solo" | "dso";
}

export interface LaunchHero {
  eyebrow: string;
  h1: string;
  sub: string;
  ctaPrimary: string;
  ctaSecondary: string;
  sideImage?: string;
}

export interface LaunchProblemStat {
  label: string;
  value: string;
  footnote: string;
}

export interface LaunchProblem {
  title: string;
  stats: LaunchProblemStat[];
}

export interface LaunchHowItWorksFrame {
  label: string;
  body: string;
  image?: string;
}

export interface LaunchHowItWorks {
  title: string;
  subtitle: string;
  frames: LaunchHowItWorksFrame[];
}

export interface LaunchFeature {
  title: string;
  body: string;
}

export interface LaunchTestimonial {
  quote: string;
  author: string;
  location: string;
  avatar?: string;
}

export interface LaunchPricingTier {
  tier: string;
  price: string;
  cadence: string;
  features: string[];
  highlight: boolean;
}

export interface LaunchFAQItem {
  q: string;
  a: string;
}

export interface LaunchWaitlistCTA {
  title: string;
  sub: string;
}

export interface LaunchPageContent extends LaunchPositioning {
  hero: LaunchHero;
  problem: LaunchProblem;
  howItWorks: LaunchHowItWorks;
  features: LaunchFeature[];
  testimonials: LaunchTestimonial[];
  pricing: LaunchPricingTier[];
  faq: LaunchFAQItem[];
  waitlistCTA: LaunchWaitlistCTA;
  posts: string[];
}
