import { BaseAgent } from "./base-agent";
import type { ExaResult } from "../tools/exa-client";

export interface ScoutSourceRef {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
}

export interface ScoutBrief {
  summary: string;
  competitors: Array<{ name: string; angle: string; url?: string }>;
  promises: string[];
  objections: string[];
  ctaPatterns: string[];
  sources: ScoutSourceRef[];
}

export interface LaunchScoutInput {
  productName: string;
  oneLineIdea: string;
  targetAudience: string;
  brandTone: string;
  exaResults: Record<string, ExaResult[]>;
}

export class LaunchScoutAgent extends BaseAgent {
  async execute(input: LaunchScoutInput): Promise<ScoutBrief> {
    const evidence = Object.entries(input.exaResults)
      .map(([queryLabel, rows]) => {
        const blocks = rows
          .map((row, idx) => `  [${idx + 1}] ${row.title} — ${row.url}\n      ${row.snippet.replace(/\s+/g, " ").trim()}`)
          .join("\n");
        return `=== Query: ${queryLabel} ===\n${blocks || "  (no results)"}`;
      })
      .join("\n\n");

    const system = [
      "You are Bifrost's competitor scout for SaaS launch missions.",
      "Synthesize web search evidence into a tight brief that the strategist and copywriter can use.",
      "Cite real findings only — never invent companies or quotes that did not appear in the evidence.",
      "Prefer named competitors with real URLs. If evidence is thin, say so honestly in the summary.",
    ].join(" ");

    const prompt = [
      `Product: ${input.productName}`,
      `Idea: ${input.oneLineIdea}`,
      `Audience: ${input.targetAudience}`,
      `Brand tone: ${input.brandTone}`,
      "",
      "Web search evidence (from Exa):",
      evidence || "(no evidence — note in summary)",
      "",
      "Produce a JSON object matching the schema. Pull all `sources` directly from the evidence URLs above.",
    ].join("\n");

    const schemaHint = `Schema:
{
  "summary": "string (2-3 sentences, ground in evidence)",
  "competitors": [
    { "name": "string", "angle": "string (one-line positioning)", "url": "string (optional)" }
  ],
  "promises": ["string (recurring marketing claims)"] ,
  "objections": ["string (buyer concerns we must defuse)"],
  "ctaPatterns": ["string (recurring CTA copy patterns)"],
  "sources": [
    { "title": "string", "url": "string", "snippet": "string", "publishedDate": "string (optional)" }
  ]
}`;

    return this.askJson<ScoutBrief>("scout_launch_market", system, prompt, schemaHint);
  }
}
