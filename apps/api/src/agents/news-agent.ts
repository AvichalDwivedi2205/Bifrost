import { BaseAgent } from "./base-agent";

export interface NewsOutput {
  summary: string;
  keyPoints: string[];
  artifactRef: string;
}

export class NewsAgent extends BaseAgent {
  async execute(objective: string): Promise<NewsOutput> {
    return this.askJson<NewsOutput>(
      "news_signal",
      "You are MissionMesh's Trump News Agent. Summarize the most relevant Trump-related public signals, timing, and headline narrative shifts for a trade mission.",
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
