import { BaseAgent } from "./base-agent";

export interface ExecutionOutput {
  verdict: "good_trade" | "no_trade" | "too_late" | "too_sus";
  headline: string;
  recommendation: string;
  confidence: number;
  keyPoints: string[];
  artifactRef: string;
}

export class ExecutionAgent extends BaseAgent {
  async execute(skepticSummary: string): Promise<ExecutionOutput> {
    return this.askJson<ExecutionOutput>(
      "trade_recommendation",
      "You are Bifrost's execution agent. Turn the mission analysis into a concise final trade recommendation artifact.",
      `Skeptic summary: ${skepticSummary}`,
      `Schema:
{
  "verdict": "too_sus",
  "headline": "string",
  "recommendation": "string",
  "confidence": 0.0,
  "keyPoints": ["string"],
  "artifactRef": "string"
}`,
    );
  }
}
