"use client";

import { buildMissionAuthorizationMessage, demoMissionInput, demoRegistry } from "@missionmesh/shared";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { createMission, resolveApiBaseUrl } from "@/lib/api";

const templates = [
  { id: "trump-polymarket", icon: "🦅", label: "Trump Polymarket Demo" },
  { id: "event-trader", icon: "📈", label: "Event Trade Research" },
  { id: "signal-hunt", icon: "🧠", label: "Signal Hunt" },
  { id: "monitoring", icon: "📡", label: "Monitoring" },
  { id: "custom", icon: "⚗", label: "Custom" },
];

const verificationModes = [
  { id: "human", icon: "👤", label: "Human" },
  { id: "hybrid", icon: "🤝", label: "Hybrid" },
  { id: "proof", icon: "🔗", label: "Proof" },
  { id: "agent", icon: "🤖", label: "Agent" },
];

const executionModes = [
  { id: "manual_assist", icon: "🧑‍✈️", label: "Manual Assist", note: "Approve agent lineup and every spend" },
  { id: "guarded_autonomy", icon: "🛡", label: "Guarded Autonomy", note: "Agents can work, but payments still wait for you" },
  { id: "full_autonomy", icon: "⚡", label: "Full Autonomy", note: "Not used in this hackathon demo" },
];

export function MissionCreateForm() {
  const router = useRouter();
  const { connected, publicKey, signMessage } = useWallet();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(demoMissionInput);

  useEffect(() => {
    if (!publicKey) {
      return;
    }

    setForm((current) => ({
      ...current,
      authorityWallet: publicKey.toBase58(),
    }));
  }, [publicKey]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === form.template) ?? templates[0],
    [form.template],
  );

  const encodeBase64 = (value: Uint8Array) =>
    btoa(String.fromCharCode(...value));

  const onSubmit = () => {
    setError(null);

    startTransition(async () => {
      try {
        if (!connected || !publicKey) {
          throw new Error("Connect a Solana wallet before deploying a mission.");
        }

        if (!signMessage) {
          throw new Error("The connected wallet does not support message signing.");
        }

        const baseUrl = resolveApiBaseUrl();
        if (!baseUrl) {
          router.push("/live?missionId=mission-demo-1");
          return;
        }

        const missionInput = {
          ...form,
          authorityWallet: publicKey.toBase58(),
          humanApprovalAbove: 0,
        };
        const issuedAt = new Date().toISOString();
        const authorizationMessage = buildMissionAuthorizationMessage(
          missionInput,
          issuedAt,
        );
        const signatureBytes = await signMessage(
          new TextEncoder().encode(authorizationMessage),
        );

        const mission = await createMission(missionInput, {
          issuedAt,
          signature: encodeBase64(signatureBytes),
        });
        router.push(`/live?missionId=${mission.id}`);
      } catch (submissionError) {
        setError(submissionError instanceof Error ? submissionError.message : "Mission deployment failed");
      }
    });
  };

  return (
    <div className="cg">
      <div>
        <div className="fs">
          <label className="lbl">Mission Template</label>
          <div className="trow">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                className={`tp ${form.template === template.id ? "sel" : ""}`}
                onClick={() => setForm((current) => ({ ...current, template: template.id }))}
              >
                <span>{template.icon}</span>
                {template.label}
              </button>
            ))}
          </div>
        </div>

        <div className="fs">
          <label className="lbl">Mission Objective</label>
          <textarea
            className="inp"
            value={form.objective}
            onChange={(event) => setForm((current) => ({ ...current, objective: event.target.value }))}
          />
        </div>

        <div className="fs two-up">
          <div>
            <label className="lbl">Success Criteria</label>
            <input
              className="inp"
              value={form.successCriteria}
              onChange={(event) =>
                setForm((current) => ({ ...current, successCriteria: event.target.value }))
              }
            />
          </div>
          <div>
            <label className="lbl">Urgency</label>
            <select
              className="inp"
              value={form.urgency}
              onChange={(event) => setForm((current) => ({ ...current, urgency: event.target.value as typeof form.urgency }))}
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <div className="fs">
          <label className="lbl">Execution Mode</label>
          <div className="mrow">
            {executionModes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={`mc ${form.executionMode === mode.id ? "sel" : ""}`}
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    executionMode: mode.id as typeof current.executionMode,
                  }))
                }
              >
                <div className="mc-ico">{mode.icon}</div>
                <div className="mc-t">{mode.label}</div>
                <div className="mc-s">{mode.note}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="fs">
          <label className="lbl">Budget Allocation (USDC)</label>
          <div className="three-up">
            <div>
              <label className="lbl mini">Total Budget</label>
              <input
                className="inp"
                type="number"
                step="0.1"
                value={form.maxBudget}
                onChange={(event) =>
                  setForm((current) => ({ ...current, maxBudget: Number(event.target.value) }))
                }
              />
            </div>
            <div>
              <label className="lbl mini">Max Per Call</label>
              <input
                className="inp"
                type="number"
                step="0.1"
                value={form.maxPerCall}
                onChange={(event) =>
                  setForm((current) => ({ ...current, maxPerCall: Number(event.target.value) }))
                }
              />
            </div>
            <div>
              <label className="lbl mini">Approval Trigger</label>
              <input
                className="inp"
                type="number"
                step="0.01"
                value={form.humanApprovalAbove}
                disabled
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    humanApprovalAbove: Number(event.target.value),
                  }))
                }
              />
              <div className="mission-meta">Locked to `0` so every payment needs approval.</div>
            </div>
          </div>
        </div>

        <div className="fs">
          <label className="lbl">Verification Mode</label>
          <div className="four-up">
            {verificationModes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={`mc compact ${form.verificationMode === mode.id ? "sel" : ""}`}
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    verificationMode: mode.id as typeof current.verificationMode,
                  }))
                }
              >
                <div className="mc-ico">{mode.icon}</div>
                <div className="mc-t">{mode.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="side-stack">
        <div className="card cp">
          <div className="stack-head">
            <span className="sh-t">Curated Registry Team</span>
            <span className="pill pl">Review First</span>
          </div>
          <div className="agent-stack">
            {demoRegistry
              .filter((agent) => agent.role !== "coordinator")
              .map((agent) => (
              <div key={agent.id} className="agent-row">
                <div className="agent-chip">{agent.icon}</div>
                <div className="agent-meta">
                  <div className="agent-name">{agent.name}</div>
                  <div className="agent-sub">
                    Trust {agent.trustScore} · {agent.supportedServices.length || "No"} paid services
                  </div>
                </div>
                <div className="agent-dot" />
              </div>
            ))}
          </div>
        </div>

        <div className="card cp">
          <div className="sh-t stack-gap">On-Chain Policy</div>
          <div className="policy-list">
            <div className="policy-row">
              <span>Authority wallet</span>
              <span>{connected && publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : "Connect wallet"}</span>
            </div>
            <div className="policy-row">
              <span>Template</span>
              <span>{selectedTemplate?.label}</span>
            </div>
            <div className="policy-row">
              <span>Budget locked</span>
              <span>{form.maxBudget.toFixed(2)} USDC</span>
            </div>
            <div className="policy-row">
              <span>Whitelisted services</span>
              <span>News, market data, replay tools</span>
            </div>
            <div className="policy-row">
              <span>Challenge window</span>
              <span>{form.challengeWindowHours}h enabled</span>
            </div>
            <div className="policy-row">
              <span>Human approval</span>
              <span>Required for every spend</span>
            </div>
            <div className="policy-row">
              <span>Agent selection</span>
              <span>Review before mission start</span>
            </div>
          </div>
        </div>

        {error ? <div className="notice error">{error}</div> : null}
        {!connected ? (
          <div className="notice warning">
            Connect a Solana wallet to anchor the mission authority and unlock deploy.
          </div>
        ) : null}

        <button className="btn bp wide" type="button" onClick={onSubmit} disabled={isPending || !connected}>
          {isPending ? "Deploying..." : "Create Mission → Review Agents"}
        </button>
      </div>
    </div>
  );
}
