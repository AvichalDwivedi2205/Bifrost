"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { buildRegistryApplicationAuthorizationMessage } from "@bifrost/shared";
import type { AgentManifest, RegistryAgent, RegistryApplication } from "@bifrost/shared";
import { useWallet } from "@solana/wallet-adapter-react";

import { TopBar } from "@/components/topbar";
import {
  createRegistryApplication,
  fetchRegistry,
  fetchRegistryApplications,
  runRegistryEvaluation,
  runRegistryProtocolCheck,
} from "@/lib/api";

const defaultSchema = '{ "type": "object", "properties": { "task": { "type": "string" } } }';
const defaultOutputSchema =
  '{ "type": "object", "properties": { "summary": { "type": "string" }, "evidence": { "type": "array" } } }';

export default function RegistryPage() {
  const wallet = useWallet();
  const [agents, setAgents] = useState<RegistryAgent[]>([]);
  const [applications, setApplications] = useState<RegistryApplication[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [agentName, setAgentName] = useState("General Research Agent");
  const [capability, setCapability] = useState("source-backed-research");
  const [endpointUrl, setEndpointUrl] = useState("mock://general-research-agent");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function refreshRegistry() {
    const [nextAgents, nextApplications] = await Promise.all([
      fetchRegistry(),
      fetchRegistryApplications(),
    ]);
    setAgents(nextAgents);
    setApplications(nextApplications);
  }

  useEffect(() => {
    refreshRegistry().catch((refreshError) => {
      setError(refreshError instanceof Error ? refreshError.message : "Failed to load registry");
    });
  }, []);

  const filteredAgents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return agents;
    }
    return agents.filter((agent) =>
      [agent.name, agent.description, agent.role, ...agent.capabilities]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [agents, search]);

  async function handleRegisterAndEvaluate() {
    setError("");
    if (!wallet.publicKey || !wallet.signMessage) {
      setError("Connect a wallet with message signing to register an agent.");
      return;
    }

    setIsSubmitting(true);
    try {
      const ownerWallet = wallet.publicKey.toBase58();
      const slug = slugify(agentName);
      const capabilityId = slugify(capability);
      const now = new Date().toISOString();
      const manifest: AgentManifest = {
        agentId: `${slug}-${Date.now()}`,
        slug,
        name: agentName,
        description:
          "Agent registered through Bifrost with capability-level sandbox evaluation.",
        icon: "AI",
        ownerWallet,
        payoutWallet: ownerWallet,
        verifierWallet: ownerWallet,
        endpointUrl,
        role: "custom",
        executionMode: "callback",
        capabilities: [
          {
            id: capabilityId,
            label: capability,
            description:
              "Completes bounded tasks with structured outputs, evidence references, and budget discipline.",
            version: "1.0.0",
            inputSchema: defaultSchema,
            outputSchema: defaultOutputSchema,
            requiredTools: ["bifrost-runtime"],
            allowedServices: ["mock-sandbox"],
            evaluationSuiteId: "generic-capability-v1",
          },
        ],
        phaseSchema: [
          {
            id: "plan",
            label: "Plan",
            description: "Read the task and decide a bounded execution path.",
            streams: true,
          },
          {
            id: "produce",
            label: "Produce",
            description: "Return the structured result and evidence references.",
            streams: true,
          },
        ],
        supportedServices: ["mock-sandbox"],
        spendPolicy: {
          maxPerCall: 0.1,
          budgetCap: 0.5,
          requiresHumanAbove: 0,
        },
        priceModel: "Sandbox mock pricing",
        metadataUri: `mock://${slug}/metadata.json`,
        privacyPolicyUri: `mock://${slug}/privacy.json`,
        requestedEvaluationSuites: ["generic-capability-v1"],
        signedAt: now,
      };
      const issuedAt = new Date().toISOString();
      const signatureBytes = await wallet.signMessage(
        new TextEncoder().encode(
          buildRegistryApplicationAuthorizationMessage(manifest, issuedAt),
        ),
      );
      const signature = bytesToBase64(signatureBytes);

      const application = await createRegistryApplication(manifest, {
        issuedAt,
        signature,
      });
      const checked = await runRegistryProtocolCheck(application.id);
      const evaluated = checked.status === "rejected"
        ? { application: checked }
        : await runRegistryEvaluation(checked.id);
      setApplications((current) => [
        evaluated.application,
        ...current.filter((item) => item.id !== evaluated.application.id),
      ]);
      await refreshRegistry();
      setShowForm(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to register agent",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page-shell">
      <TopBar
        title="Agent Registry"
        actions={
          <button className="btn bp" onClick={() => setShowForm((value) => !value)}>
            {showForm ? "Close" : "+ Register Agent"}
          </button>
        }
      />
      <div className="page-pad">
        {showForm ? (
          <div className="reg-panel">
            <div>
              <div className="rn">Register Capability-Certified Agent</div>
              <div className="rd">
                Submit a signed manifest, run mocked protocol checks, then sandbox certify the
                declared capability.
              </div>
            </div>
            <div className="reg-grid">
              <label className="reg-field">
                Agent name
                <input value={agentName} onChange={(event) => setAgentName(event.target.value)} />
              </label>
              <label className="reg-field">
                Capability
                <input
                  value={capability}
                  onChange={(event) => setCapability(event.target.value)}
                />
              </label>
              <label className="reg-field wide">
                Runtime endpoint
                <input
                  value={endpointUrl}
                  onChange={(event) => setEndpointUrl(event.target.value)}
                />
              </label>
            </div>
            <button className="btn bp" disabled={isSubmitting} onClick={handleRegisterAndEvaluate}>
              {isSubmitting ? "Evaluating..." : "Sign, Register, Evaluate"}
            </button>
          </div>
        ) : null}

        {error ? <div className="reg-error">{error}</div> : null}

        <div className="sr">
          <input
            className="si"
            placeholder="Search by capability, domain, or name..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="fi">All Domains</div>
          <div className="fi">Trust: High</div>
          <div className="fi">Available</div>
        </div>

        {applications.length > 0 ? (
          <div className="eval-strip">
            {applications.slice(0, 3).map((application) => (
              <div className="eval-card" key={application.id}>
                <div className="tmc">{application.status}</div>
                <div className="rn">{application.manifest.name}</div>
                <div className="rd">
                  {application.certifiedCapabilities.length} certified,{" "}
                  {application.rejectedClaims.length} rejected
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="rg">
          {filteredAgents.map((agent) => (
            <Link className="rc" href="/profile" key={agent.id}>
              <div className="ri">{agent.icon}</div>
              <div className="rn">{agent.name}</div>
              <div className="rd">{agent.description}</div>
              <div className="cw">
                {agent.capabilities.map((agentCapability) => (
                  <span key={agentCapability} className="cap">
                    {agentCapability}
                  </span>
                ))}
              </div>
              {agent.certifiedCapabilities?.length ? (
                <div className="cw">
                  {agent.certifiedCapabilities.map((certified) => (
                    <span key={certified.capabilityId} className="cap ok">
                      {certified.status}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="cw">
                  {agent.phaseSchema.map((phase) => (
                    <span key={phase.id} className="cap">
                      {phase.label}
                    </span>
                  ))}
                </div>
              )}
              <div className="tr2">
                <div>
                  <div className="tsc">{agent.trustScore}</div>
                  <div className="tmc">Trust Score</div>
                </div>
                <div className="tmc">
                  {agent.evaluationSummary
                    ? `${agent.evaluationSummary.claimsVerified.length} claims verified`
                    : `${agent.totalMissions} missions`}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48) || "agent";
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
