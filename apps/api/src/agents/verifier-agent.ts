import type { VerificationCheck } from "@bifrost/shared";

import { BaseAgent } from "./base-agent";

export interface VerificationOutput {
  approved: boolean;
  proofHash: string;
  summary: string;
  checks: VerificationCheck[];
}

export class VerifierAgent extends BaseAgent {
  async execute(successCriteria: string, finalRecommendation: string): Promise<VerificationOutput> {
    return this.askJson<VerificationOutput>(
      "verify_mission",
      "You are Bifrost's verifier agent. Check outputs against mission success criteria and produce a proof hash with a strict yes or no verdict.",
      `Success criteria: ${successCriteria}
Final recommendation: ${finalRecommendation}`,
      `Schema:
{
  "approved": true,
  "proofHash": "string",
  "summary": "string",
  "checks": [{"id":"string","label":"string","status":"passed"}]
}`,
    );
  }
}

