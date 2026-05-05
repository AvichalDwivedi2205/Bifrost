import type { AgentMessageBus } from "../services/agent-message-bus";
import { BaseAgent } from "./base-agent";

export interface SkepticOutput {
  verdict: "good_trade" | "no_trade" | "too_late" | "too_sus";
  summary: string;
  confidence: number;
  keyPoints: string[];
  artifactRef: string;
}

export interface SkepticContext {
  missionId: string;
  messageBus?: AgentMessageBus;
}

export class SkepticAgent extends BaseAgent {
  async execute(
    newsSummary: string,
    marketSummary: string,
    ctx?: SkepticContext,
  ): Promise<SkepticOutput> {
    const output = await this.askJson<SkepticOutput>(
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

    if (ctx?.messageBus && ctx.missionId &&
        (output.verdict === "too_sus" || output.confidence >= 0.6)) {
      await ctx.messageBus.challengeClaim(
        ctx.missionId,
        "skeptic-1",
        "execution-1",
        output.summary || "Asymmetry detected — confirm thesis before packaging?",
        output.artifactRef ? [output.artifactRef] : undefined,
      );
    }

    return output;
  }
}
