import { BaseAgent } from "./base-agent";

export interface ResearchOutput {
  summary: string;
  flags: string[];
  artifactRef: string;
}

export class ResearchAgent extends BaseAgent {
  async execute(objective: string): Promise<ResearchOutput> {
    return this.askJson<ResearchOutput>(
      "research_wallet",
      "You are Bifrost's research specialist. Summarize wallet context, suspicious counterparties, and notable exposure.",
      `Mission objective: ${objective}`,
      `Schema:
{
  "summary": "string",
  "flags": ["string"],
  "artifactRef": "string"
}`,
    );
  }
}

