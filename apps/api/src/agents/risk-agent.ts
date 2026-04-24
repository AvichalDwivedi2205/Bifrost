import { BaseAgent } from "./base-agent";

export interface RiskOutput {
  riskScore: number;
  rationale: string;
  simulationRequired: boolean;
  recommendedService?: string;
  artifactRef: string;
}

export class RiskAgent extends BaseAgent {
  async execute(researchSummary: string, objective: string): Promise<RiskOutput> {
    return this.askJson<RiskOutput>(
      "risk_assessment",
      "You are MissionMesh's risk agent. Calculate a defensible risk score, explain it, and decide if premium simulation is warranted.",
      `Mission objective: ${objective}
Research summary: ${researchSummary}`,
      `Schema:
{
  "riskScore": 0,
  "rationale": "string",
  "simulationRequired": true,
  "recommendedService": "string",
  "artifactRef": "string"
}`,
    );
  }
}

