import { BaseAgent } from "./base-agent";

export interface NewsOutput {
  summary: string;
  keyPoints: string[];
  artifactRef: string;
}

export class NewsAgent extends BaseAgent {
  async execute(objective: string): Promise<NewsOutput> {
    const isWalletMission = objective.toLowerCase().includes("wallet");
    const systemPrompt = isWalletMission
      ? "You are Bifrost's on-chain wallet intelligence analyst. Surface stale token approvals, suspicious contract interactions, and recurring spend patterns. Cite specific contract addresses, approval ages, and revocation guidance. Focus on actionable findings the wallet owner can act on immediately."
      : "You are Bifrost's Trump News Agent. Summarize the most relevant Trump-related public signals, timing, and headline narrative shifts for a trade mission.";

    return this.askJson<NewsOutput>(
      "news_signal",
      systemPrompt,
      `Mission objective: ${objective}`,
      `Schema:
{
  "summary": "string",
  "keyPoints": ["string"],
  "artifactRef": "string"
}`,
    );
  }
}
