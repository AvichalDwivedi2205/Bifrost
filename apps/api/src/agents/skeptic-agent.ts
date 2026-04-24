import { BaseAgent } from "./base-agent";

export interface SkepticOutput {
  verdict: "good_trade" | "no_trade" | "too_late" | "too_sus";
  summary: string;
  confidence: number;
  keyPoints: string[];
  artifactRef: string;
}

export class SkepticAgent extends BaseAgent {
  async execute(newsSummary: string, marketSummary: string): Promise<SkepticOutput> {
    return this.askJson<SkepticOutput>(
      "skeptic_review",
      "You are Bifrost's Skeptic Agent. Challenge the trade thesis and determine whether it is good, stale, or too suspicious to touch.",
      `News summary: ${newsSummary}
Market summary: ${marketSummary}`,
      `Schema:
{
  "verdict": "too_sus",
  "summary": "string",
  "confidence": 0.0,
  "keyPoints": ["string"],
  "artifactRef": "string"
}`,
    );
  }
}
