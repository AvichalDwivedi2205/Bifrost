"use client";

import type { AgentRole, MissionAuthEnvelope, MissionEvent, MissionRecord } from "@missionmesh/shared";
import {
  buildSelectionAuthorizationMessage,
  buildSpendApprovalAuthorizationMessage,
  demoMissionRecord,
} from "@missionmesh/shared";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useMemo, useState } from "react";

import {
  approveMissionSelection,
  fetchMission,
  resolveApiBaseUrl,
  resolveSpendApproval,
  subscribeToMission,
} from "@/lib/api";
import { timeAgo } from "@/lib/format";

const selectionRoles: AgentRole[] = [
  "news",
  "market",
  "skeptic",
  "execution",
  "verifier",
];

const rotatingEvents = [
  {
    type: "TASK_COMPLETE",
    label: "News bundle finalized",
  },
  {
    type: "SPEND_APPROVAL_REQUIRED",
    label: "Mission paused until a human approves the payment",
  },
  {
    type: "VERIFICATION_APPROVED",
    label: "Verifier approved the mission result",
  },
] as const;

function statusPill(status: string) {
  if (status === "complete" || status === "settled" || status === "passed") return "pg2";
  if (status === "active" || status === "working" || status === "running" || status === "verifying") return "pa";
  if (
    status === "waiting" ||
    status === "pending" ||
    status === "selection_pending" ||
    status === "awaiting_spend_approval" ||
    status === "blocked"
  ) {
    return "pm";
  }
  return "pb";
}

function eventIcon(item: MissionEvent): string {
  switch (item.type) {
    case "SPEND_APPROVED":
      return "◎";
    case "SPEND_REQUESTED":
    case "SPEND_APPROVAL_REQUIRED":
      return "¤";
    case "AGENT_PHASE_STARTED":
    case "AGENT_PHASE_UPDATED":
      return "↺";
    case "AGENT_PHASE_COMPLETED":
      return "▣";
    case "TASK_COMPLETE":
    case "VERIFICATION_APPROVED":
      return "✓";
    case "MISSION_FAILED":
    case "VERIFICATION_REJECTED":
    case "SPEND_REJECTED":
    case "AGENT_PHASE_FAILED":
      return "!";
    default:
      return "⬡";
  }
}

export function LiveMissionView({ missionId }: { missionId?: string }) {
  const { connected, publicKey, signMessage } = useWallet();
  const [mission, setMission] = useState<MissionRecord>(demoMissionRecord);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const encodeBase64 = (value: Uint8Array) => btoa(String.fromCharCode(...value));

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (!missionId) {
        return;
      }

      const baseUrl = resolveApiBaseUrl();
      if (!baseUrl) {
        return;
      }

      const nextMission = await fetchMission(missionId);
      if (!cancelled) {
        setMission(nextMission);
      }
    }

    hydrate().catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [missionId]);

  useEffect(() => {
    if (!missionId || !resolveApiBaseUrl()) {
      const interval = window.setInterval(() => {
        setMission((current) => {
          const next =
            rotatingEvents[current.events.length % rotatingEvents.length] ?? rotatingEvents[0];
          const syntheticEvent: MissionEvent = {
            id: `synthetic-${current.events.length + 1}`,
            missionId: current.id,
            type: next.type,
            label: next.label,
            createdAt: new Date().toISOString(),
          } as MissionEvent;

          return {
            ...current,
            events: [...current.events, syntheticEvent],
          };
        });
      }, 7000);

      return () => window.clearInterval(interval);
    }

    return subscribeToMission(missionId, setMission);
  }, [missionId]);

  useEffect(() => {
    const proposal = mission.selectionProposal;
    if (!proposal) {
      return;
    }

    setSelectedAgentIds((current) =>
      current.length > 0
        ? current
        : proposal.chosenAgentIds.length > 0
          ? proposal.chosenAgentIds
          : proposal.recommendedAgentIds,
    );
  }, [mission.selectionProposal]);

  const latestReceipt = mission.receipts.at(-1);
  const spentPercent = mission.budget.totalBudget
    ? (mission.budget.spent / mission.budget.totalBudget) * 100
    : 0;

  const activeAgents = useMemo(
    () =>
      mission.agents.map((agent) => ({
        ...agent,
        tone:
          agent.status === "complete"
            ? "ad"
            : agent.status === "working"
              ? "ar"
              : "aw",
      })),
    [mission.agents],
  );

  const selectableAgents = useMemo(
    () => mission.registry.filter((agent) => selectionRoles.includes(agent.role)),
    [mission.registry],
  );

  const signApproval = async (
    message: string,
    issuedAt: string,
  ): Promise<MissionAuthEnvelope | undefined> => {
    if (!resolveApiBaseUrl()) {
      return undefined;
    }

    if (!connected || !publicKey) {
      throw new Error("Connect the mission authority wallet before approving this action.");
    }

    if (publicKey.toBase58() !== mission.input.authorityWallet) {
      throw new Error("Connect the same wallet that created the mission before approving this action.");
    }

    if (!signMessage) {
      throw new Error("The connected wallet does not support message signing.");
    }

    const signatureBytes = await signMessage(new TextEncoder().encode(message));
    return {
      issuedAt,
      signature: encodeBase64(signatureBytes),
    };
  };

  const handleAgentToggle = (agentId: string) => {
    setSelectedAgentIds((current) =>
      current.includes(agentId)
        ? current.filter((item) => item !== agentId)
        : [...current, agentId],
    );
  };

  const handleSelectionApproval = async () => {
    if (!missionId) {
      return;
    }

    setActionError(null);
    setIsSubmitting(true);
    try {
      const issuedAt = new Date().toISOString();
      const auth = await signApproval(
        buildSelectionAuthorizationMessage(
          missionId,
          mission.input.authorityWallet,
          selectedAgentIds,
          issuedAt,
        ),
        issuedAt,
      );
      const updated = await approveMissionSelection(missionId, selectedAgentIds, auth);
      setMission(updated);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to approve the agent selection",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSpendDecision = async (approvalId: string, approve: boolean) => {
    if (!missionId) {
      return;
    }

    setActionError(null);
    setIsSubmitting(true);
    try {
      const issuedAt = new Date().toISOString();
      const auth = await signApproval(
        buildSpendApprovalAuthorizationMessage(
          missionId,
          mission.input.authorityWallet,
          approvalId,
          approve,
          issuedAt,
        ),
        issuedAt,
      );
      const updated = await resolveSpendApproval(missionId, approvalId, approve, auth);
      setMission(updated);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to resolve the payment approval",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="mbar">
        <div>
          <div className="mbar-t">{mission.input.title}</div>
          <div className="mbar-pills">
            <span className="pill pl">● {mission.status}</span>
            <span className="pill pb">{mission.input.executionMode.replace(/_/g, " ")}</span>
            <span className="pill pa">{mission.input.verificationMode}</span>
            <span className="elapsed">◷ {mission.elapsedLabel}</span>
          </div>
        </div>
        <div>
          <div className="ba">{mission.budget.remaining.toFixed(2)}</div>
          <div className="bc">USDC remaining of {mission.budget.totalBudget.toFixed(2)}</div>
        </div>
      </div>

      {actionError ? <div className="notice error">{actionError}</div> : null}

      <div className="xl">
        <div className="xll">
          {mission.selectionProposal && mission.status === "selection_pending" ? (
            <div className="card cp">
              <div className="stack-head">
                <span className="sh-t">Approve Agent Lineup</span>
                <span className="pill pm">Human Gate</span>
              </div>
              <div className="body-copy section-gap">{mission.selectionProposal.reason}</div>
              <div className="graph-grid">
                {selectableAgents.map((agent) => {
                  const selected = selectedAgentIds.includes(agent.id);
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      className={`graph-node ${selected ? "pa" : "pb"}`}
                      onClick={() => handleAgentToggle(agent.id)}
                    >
                      <div className="graph-state">{agent.role}</div>
                      <div className="graph-title">
                        {agent.icon} {agent.name}
                      </div>
                      <div className="graph-meta">Trust {agent.trustScore}</div>
                    </button>
                  );
                })}
              </div>
              <div className="settlement-note">
                MissionMesh will not start until you approve the selected agents with the mission authority wallet.
              </div>
              <button
                className="btn bp wide"
                type="button"
                disabled={isSubmitting}
                onClick={handleSelectionApproval}
              >
                {isSubmitting ? "Submitting..." : "Approve Agent Selection"}
              </button>
            </div>
          ) : null}

          {mission.pendingSpendApprovals.length > 0 ? (
            <div className="card cp">
              <div className="stack-head">
                <span className="sh-t">Pending Payment Approvals</span>
                <span className="pill pm">{mission.pendingSpendApprovals.length} waiting</span>
              </div>
              <div className="agent-stack">
                {mission.pendingSpendApprovals.map((approval) => (
                  <div key={approval.id} className="card cp">
                    <div className="mission-title">
                      {approval.service} · {approval.amount.toFixed(2)} USDC
                    </div>
                    <div className="mission-meta">{approval.justification}</div>
                    <div className="mission-meta">Purpose: {approval.purpose}</div>
                    <div className="mission-meta">
                      This decision requires a fresh wallet signature from the mission authority.
                    </div>
                    <div className="stack-head section-gap">
                      <button
                        className="btn bp micro"
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleSpendDecision(approval.id, true)}
                      >
                        Approve Payment
                      </button>
                      <button
                        className="btn bk micro"
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleSpendDecision(approval.id, false)}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <div className="mono-label section-gap">Selected Agents</div>
            <div className="agents">
              {activeAgents.map((agent) => (
                <div key={agent.id} className={`ag ${agent.tone}`}>
                  <div className="ag-ico">{agent.icon}</div>
                  <div className="ag-n">{agent.name}</div>
                  <div className="ag-r">{agent.description}</div>
                  <span className={`pill ${statusPill(agent.status ?? "idle")}`}>
                    {agent.status ?? "idle"}
                  </span>
                  <div className="mission-meta">{agent.currentAction ?? "Queued"}</div>
                  {agent.phaseSchema.length > 0 ? (
                    <div className="section-gap">
                      {agent.phaseSchema.map((phase) => {
                        const latestRun = [...(agent.phaseHistory ?? [])]
                          .filter((run) => run.phaseId === phase.id)
                          .at(-1);
                        const phaseStatus =
                          latestRun?.status ??
                          (agent.currentPhaseId === phase.id
                            ? agent.currentPhaseStatus ?? "pending"
                            : "pending");

                        return (
                          <div key={phase.id} className="policy-row">
                            <span>{phase.label}</span>
                            <span className={`pill ${statusPill(phaseStatus)}`}>
                              {phaseStatus}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  <div className="ag-s">
                    Spend <b>${(agent.costIncurred ?? 0).toFixed(2)}</b>
                  </div>
                  <div className="tbar">
                    <div className="tf" style={{ width: `${Math.min(agent.trustScore, 100)}%` }} />
                  </div>
                  <div className="tn">Trust {agent.trustScore}/100</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card graph-card">
            <div className="mono-label section-gap">Task Graph</div>
            <div className="graph-grid">
              {mission.tasks.map((task) => (
                <div key={task.id} className={`graph-node ${statusPill(task.status)}`}>
                  <div className="graph-state">{task.status}</div>
                  <div className="graph-title">{task.title}</div>
                  <div className="graph-meta">{task.assignedAgent}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card cp">
            <div className="mono-label section-gap">Agent Phase Stream</div>
            {activeAgents.map((agent) => (
              <div key={agent.id} className="section-gap">
                <div className="policy-row">
                  <span>
                    {agent.icon} {agent.name}
                  </span>
                  <span className={`pill ${statusPill(agent.currentPhaseStatus ?? "pending")}`}>
                    {agent.currentPhaseId ?? "queued"}
                  </span>
                </div>
                <div className="settlement-note">
                  {agent.currentAction ?? "Waiting for mission start"}
                </div>
                {agent.phaseHistory?.length ? (
                  <div className="cw section-gap">
                    {agent.phaseHistory.map((phase) => (
                      <span key={`${agent.id}-${phase.phaseId}-${phase.attempt}`} className="cap">
                        {phase.phaseId.replace(/_/g, " ")} · {phase.status}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="card tl">
            <div className="tlh">
              <div className="tld" />
              <span className="sh-t">Mission Timeline</span>
            </div>
            <div id="tlfeed">
              {mission.events.map((item) => (
                <div key={item.id} className="tli">
                  <div className="tl-ic">{eventIcon(item)}</div>
                  <div className="tl-b">
                    <div className="tl-e">{item.label}</div>
                    {"txSignature" in item && item.txSignature ? (
                      <div className="tx">{item.txSignature}</div>
                    ) : null}
                    <div className="tl-ti">{timeAgo(item.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="xlr">
          {mission.finalResult ? (
            <div className="card cp">
              <div className="mono-label section-gap">Final Recommendation</div>
              <div className="mission-title">{mission.finalResult.headline}</div>
              <div className="body-copy">{mission.finalResult.summary}</div>
              <div className="cw section-gap">
                {mission.finalResult.keyPoints.map((point) => (
                  <span key={point} className="cap">
                    {point}
                  </span>
                ))}
              </div>
              <div className="policy-row">
                <span>Verdict</span>
                <span>{mission.finalResult.verdict.replace(/_/g, " ")}</span>
              </div>
              <div className="policy-row">
                <span>Confidence</span>
                <span>{Math.round(mission.finalResult.confidence * 100)}%</span>
              </div>
            </div>
          ) : null}

          <div className="card bp2">
            <div className="mono-label section-gap">Budget Dashboard</div>
            {mission.agents.map((agent) => (
              <div key={agent.id} className="prow">
                <div className="bbl">
                  <span>{agent.name}</span>
                  <span>{(agent.costIncurred ?? 0).toFixed(2)} USDC</span>
                </div>
                <div className="bbt">
                  <div
                    className="bbf fa"
                    style={{
                      width: `${Math.min(
                        100,
                        agent.budgetCap ? ((agent.costIncurred ?? 0) / agent.budgetCap) * 100 : 0,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            <div className="bbs">
              <div className="bbc">
                <div className="bbn amber">{mission.budget.spent.toFixed(2)}</div>
                <div className="bbla">Spent</div>
              </div>
              <div className="bbc">
                <div className="bbn neutral">{mission.budget.reserved.toFixed(2)}</div>
                <div className="bbla">Reserved</div>
              </div>
              <div className="bbc">
                <div className="bbn lime">{mission.budget.remaining.toFixed(2)}</div>
                <div className="bbla">Left</div>
              </div>
            </div>
            <div className="budget-ring">
              <div className="budget-fill" style={{ width: `${spentPercent}%` }} />
            </div>
          </div>

          <div className="card cp">
            <div className="mono-label section-gap">Latest Receipt</div>
            {latestReceipt ? (
              <div className="rec">
                <div className="rr">
                  <span className="rl">Mission</span>
                  <span className="rv">{latestReceipt.missionId}</span>
                </div>
                <div className="rr">
                  <span className="rl">Agent</span>
                  <span className="rv">{latestReceipt.agentId}</span>
                </div>
                <div className="rr">
                  <span className="rl">Service</span>
                  <span className="rv">{latestReceipt.serviceWallet}</span>
                </div>
                <div className="rr">
                  <span className="rl">Amount</span>
                  <span className="rv">{latestReceipt.amount.toFixed(2)} USDC</span>
                </div>
                <div className="rr">
                  <span className="rl">Purpose</span>
                  <span className="rv">{latestReceipt.purpose}</span>
                </div>
                <div className="rr">
                  <span className="rl">TX Sig</span>
                  <span className="rv">{latestReceipt.txSignature}</span>
                </div>
              </div>
            ) : (
              <div className="settlement-note">No payments have been approved yet.</div>
            )}
          </div>

          <div className="card vp">
            <div className="mono-label section-gap">Verification Panel</div>
            {mission.verificationChecks.length > 0 ? (
              mission.verificationChecks.map((check) => (
                <div key={check.id} className="vc">
                  <div className={`vi ${statusPill(check.status)}`}>
                    {check.status === "passed" ? "✓" : "◷"}
                  </div>
                  <span>{check.label}</span>
                </div>
              ))
            ) : (
              <div className="settlement-note">Verification begins after the final recommendation is produced.</div>
            )}
          </div>

          <div className="card cp">
            <div className="mono-label section-gap">Chain + RPC</div>
            <div className="policy-row">
              <span>Provider</span>
              <span>{mission.chain?.rpcProvider ?? "unknown"}</span>
            </div>
            <div className="policy-row">
              <span>HTTP</span>
              <span>{mission.chain?.rpcHttpUrl ?? "Not configured"}</span>
            </div>
            <div className="policy-row">
              <span>Streaming</span>
              <span>{mission.chain?.rpcStreamingEnabled ? "enabled" : "disabled"}</span>
            </div>
            <div className="settlement-note">
              {mission.chain?.rpcProvider === "rpcfast" || mission.chain?.rpcProvider === "rpcfast-ready"
                ? "This mission is wired to run against an RPC Fast-ready Solana endpoint."
                : "RPC provider can be swapped at runtime without changing the mission flow."}
            </div>
          </div>

          <div className="card cp">
            <div className="mono-label section-gap">Settlement State</div>
            <div className="st">
              {["selection_pending", "active", "awaiting_spend_approval", "verifying", "settled"].map(
                (step) => (
                  <div
                    key={step}
                    className={`ss ${
                      mission.status === step || mission.settlement.state === step
                        ? "s-n"
                        : ""
                    }`}
                  >
                    {step}
                  </div>
                ),
              )}
            </div>
            <div className="settlement-note">
              {mission.status === "settled"
                ? `Refunded ${mission.settlement.refundedAmount.toFixed(2)} USDC after settlement.`
                : "MissionMesh will only release settlement after verification passes."}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
