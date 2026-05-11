import { BaseAgent } from "./base-agent";
import type { ScoutBrief } from "./launch-scout-agent";

/** Mirrors apps/web/app/launch/dental-sdr/types.ts LaunchPageContent (image fields stripped). */
export interface LandingPageCopy {
  positioning: "solo" | "dso";
  hero: {
    eyebrow: string;
    h1: string;
    sub: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  problem: {
    title: string;
    stats: Array<{ label: string; value: string; footnote: string }>;
  };
  howItWorks: {
    title: string;
    subtitle: string;
    frames: Array<{ label: string; body: string }>;
  };
  features: Array<{ title: string; body: string }>;
  testimonials: Array<{ quote: string; author: string; location: string }>;
  pricing: Array<{ tier: string; price: string; cadence: string; features: string[]; highlight: boolean }>;
  faq: Array<{ q: string; a: string }>;
  waitlistCTA: { title: string; sub: string };
  posts: string[];
}

export interface LaunchCopywriterInput {
  productName: string;
  oneLineIdea: string;
  targetAudience: string;
  brandTone: string;
  primaryCTA: string;
  selectedDirection: string;
  scoutBrief?: ScoutBrief;
}

export class LaunchCopywriterAgent extends BaseAgent {
  async execute(input: LaunchCopywriterInput): Promise<LandingPageCopy> {
    const evidenceLines: string[] = [];
    if (input.scoutBrief) {
      evidenceLines.push(`Scout summary: ${input.scoutBrief.summary}`);
      if (input.scoutBrief.competitors.length) {
        evidenceLines.push(`Top competitors: ${input.scoutBrief.competitors.map((c) => `${c.name} (${c.angle})`).join("; ")}`);
      }
      if (input.scoutBrief.promises.length) {
        evidenceLines.push(`Recurring promises in the category: ${input.scoutBrief.promises.join("; ")}`);
      }
      if (input.scoutBrief.objections.length) {
        evidenceLines.push(`Buyer objections to defuse: ${input.scoutBrief.objections.join("; ")}`);
      }
      if (input.scoutBrief.ctaPatterns.length) {
        evidenceLines.push(`CTA patterns observed: ${input.scoutBrief.ctaPatterns.join("; ")}`);
      }
    }

    const positioning = /\bdso\b|\bgroup\b|\bmulti[- ]?location\b/i.test(input.selectedDirection)
      ? "dso"
      : "solo";

    const system = [
      "You are Bifrost's launch copywriter for SaaS products.",
      "Write conversion-tuned landing copy: hero, problem stats, how-it-works frames, features, testimonials, pricing, FAQ, and 3 launch tweets.",
      "Voice must match the brand tone. Use specific, plausible numbers (no marketing puff).",
      "If you cite stats, prefer round figures the operator could defend. Never invent named customers — testimonials should be plausible composites with first-name + last-initial dentists.",
      "Output strict JSON. No markdown, no commentary.",
    ].join(" ");

    const prompt = [
      `Product: ${input.productName}`,
      `Idea: ${input.oneLineIdea}`,
      `Audience: ${input.targetAudience}`,
      `Brand tone: ${input.brandTone}`,
      `Primary CTA: ${input.primaryCTA}`,
      `Selected positioning direction (from the human checkpoint): ${input.selectedDirection}`,
      `Positioning bucket: ${positioning}`,
      "",
      ...evidenceLines,
      "",
      "Write the full LandingPageCopy as JSON.",
      "Constraints: hero.h1 ≤ 14 words. hero.sub ≤ 28 words. problem.stats has exactly 3 entries with concrete `value` (e.g., \"27%\", \"4.5h\", \"$120\"). howItWorks.frames has exactly 4 entries. features has 6 entries. testimonials has 6 entries. pricing has 3 tiers with the middle one `highlight: true`. faq has 6 entries. posts has exactly 3 launch posts ≤ 280 chars each.",
    ].join("\n");

    const schemaHint = `Schema:
{
  "positioning": "solo" | "dso",
  "hero": { "eyebrow": "string", "h1": "string", "sub": "string", "ctaPrimary": "string", "ctaSecondary": "string" },
  "problem": {
    "title": "string",
    "stats": [{ "label": "string", "value": "string", "footnote": "string" }]
  },
  "howItWorks": {
    "title": "string",
    "subtitle": "string",
    "frames": [{ "label": "string", "body": "string" }]
  },
  "features": [{ "title": "string", "body": "string" }],
  "testimonials": [{ "quote": "string", "author": "string", "location": "string" }],
  "pricing": [{ "tier": "string", "price": "string", "cadence": "string", "features": ["string"], "highlight": true | false }],
  "faq": [{ "q": "string", "a": "string" }],
  "waitlistCTA": { "title": "string", "sub": "string" },
  "posts": ["string"]
}`;

    return this.askJson<LandingPageCopy>(
      "write_launch_landing_copy",
      system,
      prompt,
      schemaHint,
    );
  }
}
