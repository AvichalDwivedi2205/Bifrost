import { BaseAgent } from "./base-agent";

export interface MarketOutput {
  summary: string;
  markets: string[];
  artifactRef: string;
}

export class MarketAgent extends BaseAgent {
  async execute(objective: string, newsSummary: string): Promise<MarketOutput> {
    return this.askJson<MarketOutput>(
      "market_scan",
      "You are MissionMesh's Polymarket Market Agent. Review the current Trump-linked markets, market structure, and price movement context for the mission.",
      `Mission objective: ${objective}
News summary: ${newsSummary}`,
      `Schema:
{
  "summary": "string",
  "markets": ["string"],
  "artifactRef": "string"
}`,
    );
  }
}
