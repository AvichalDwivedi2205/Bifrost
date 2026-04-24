import type { MissionInput, MissionRecord, MissionTask, VerificationCheck } from "@bifrost/shared";
import { Annotation } from "@langchain/langgraph";

export interface GraphArtifacts {
  researchSummary?: string;
  researchArtifactRef?: string;
  riskScore?: number;
  riskSummary?: string;
  riskArtifactRef?: string;
  executionRecommendation?: string;
  executionArtifactRef?: string;
  proofHash?: string;
  verificationSummary?: string;
}

const latest = <T>() => ({
  reducer: (_left: T | undefined, right: T | undefined) => right,
  default: () => undefined as T | undefined,
});

export const MissionStateAnnotation = Annotation.Root({
  missionId: Annotation<string>(),
  input: Annotation<MissionInput>(),
  record: Annotation<MissionRecord>(),
  tasks: Annotation<MissionTask[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  artifacts: Annotation<GraphArtifacts>({
    reducer: (_left, right) => ({ ..._left, ...right }),
    default: () => ({}),
  }),
  verificationChecks: Annotation<VerificationCheck[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  verificationApproved: Annotation<boolean | undefined>(latest<boolean>()),
});

export type MissionGraphState = typeof MissionStateAnnotation.State;

