#!/usr/bin/env bun
/**
 * Seed the 6 launch-mission agents through the registration pipeline so their
 * AgentRegistry PDAs are anchored on devnet. Idempotent — run twice and the
 * second run reports "skipped (already registered)" for each.
 *
 * Prereqs:
 *   - API server running with SOLANA_ENABLE_REAL_TXS=true and a fixed
 *     OPENROUTER_MODEL (e.g. `bun --cwd apps/api dev`).
 *   - Solana CLI keypair `~/.config/solana/id.json` funded on devnet
 *     (the bifrost_local harness uses it as payer for register-agent).
 *
 * Usage:
 *   bun scripts/seed-launch-agents.ts
 *
 * Output:
 *   - Prints a TS object literal mapping agentId → { wallet, payoutWallet,
 *     verifierWallet, agentRegistryPda, anchorTx } that you paste into
 *     packages/shared/src/demo.ts to replace the placeholder wallet strings.
 *   - Writes the same to scripts/.seed-output.json (gitignored).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import {
  buildRegistryApplicationAuthorizationMessage,
  type AgentManifest,
} from "@bifrost/shared";

const API_BASE = process.env.BIFROST_API_BASE ?? "http://localhost:8787";
const SEED_DIR = resolve(import.meta.dirname, ".seed-keys");
const OUT_PATH = resolve(import.meta.dirname, ".seed-output.json");

interface CapabilitySpec {
  id: string;
  label: string;
  description: string;
  inputSchema: string;
  outputSchema: string;
  requiredTools: string[];
  allowedServices: string[];
}

interface SeedSpec {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  role: AgentManifest["role"];
  capabilities: CapabilitySpec[];
  supportedServices: string[];
  evaluationSuiteId: string;
  endpointUrl: string;
}

const SEED_SPECS: SeedSpec[] = [
  {
    id: "launch-strategist-1",
    slug: "launch-strategist",
    name: "Launch Strategist",
    description:
      "Turns mission briefs into 2-3 distinct launch positioning angles, a phased plan with explicit human checkpoints, and structured decision prompts for operators. Reads brief context, audience signals, and budget caps; emits angle cards plus a checkpoint blueprint that downstream agents block on.",
    icon: "S",
    role: "planner",
    capabilities: [
      {
        id: "positioning",
        label: "Positioning angles",
        description:
          "Synthesizes 2-3 distinct launch positioning angles from the mission brief and audience hints, each with a one-liner, audience fit rationale, and supporting evidence references.",
        inputSchema: `{ "missionId": "string<=48", "briefMarkdown": "string<=4096", "audienceHints": ["string<=120"], "brandTone": "string<=64" }`,
        outputSchema: `{ "angles": [{ "label": "string<=64", "oneLiner": "string<=140", "audienceFit": "string<=240", "supportingEvidence": ["string<=200"], "confidence": "number 0..1" }], "summary": "string<=480", "sources": ["string<=200"] }`,
        requiredTools: [],
        allowedServices: [],
      },
      {
        id: "launch-plan",
        label: "Phased launch plan",
        description:
          "Decomposes a chosen positioning into a phased launch plan with explicit owner agent ids, deliverable references, and budget allocations summing to mission cap.",
        inputSchema: `{ "missionId": "string<=48", "selectedAngle": "string<=64", "budgetCapUsd": "number 0..1000", "channels": ["string<=32"] }`,
        outputSchema: `{ "phases": [{ "phaseId": "string<=32", "ownerAgentId": "string<=64", "deliverables": ["string<=120"], "budgetAllocation": "number 0..1000", "verificationExpectation": "string<=240" }], "totalBudget": "number", "summary": "string<=480" }`,
        requiredTools: [],
        allowedServices: [],
      },
      {
        id: "checkpoint-design",
        label: "Human checkpoint blueprints",
        description:
          "Produces structured human-checkpoint blueprints with kind, prompt copy, option lists, and blocking-task references so the runner can pause execution for signed answers.",
        inputSchema: `{ "missionId": "string<=48", "plan": "object", "policy": { "askBeforeSpend": "boolean", "domainBudgetCap": "number 0..1000" } }`,
        outputSchema: `{ "checkpoints": [{ "kind": "positioning|domain|ship|other", "prompt": "string<=240", "options": ["string<=120"], "freeformAllowed": "boolean", "blockingTaskIds": ["string<=64"] }], "summary": "string<=240" }`,
        requiredTools: [],
        allowedServices: [],
      },
    ],
    supportedServices: [],
    evaluationSuiteId: "planner-baseline-v1",
    endpointUrl: "https://agents.bifrost.io/launch-strategist",
  },
  {
    id: "competitor-map-1",
    slug: "competitor-map-agent",
    name: "Launch Landscape Scout",
    description:
      "Surveys live competitors and prior shipped products in the mission's category via web search and Colosseum index lookups, then computes positioning gaps the team can claim. Reads domain queries and regional hints; emits a competitor list with messaging patterns plus a gap-analysis report scoring opportunity per theme.",
    icon: "L",
    role: "research",
    capabilities: [
      {
        id: "competitor-map",
        label: "Competitor map",
        description:
          "Returns a structured list of named competitors in the mission's domain with their primary claim, hero messaging pattern, evidence URL, and recency timestamp.",
        inputSchema: `{ "missionId": "string<=48", "domainQuery": "string<=200", "regionHint": "string<=32", "maxResults": "number 1..20" }`,
        outputSchema: `{ "competitors": [{ "name": "string<=80", "url": "string<=240", "primaryClaim": "string<=200", "messagingPattern": "string<=200", "evidenceUrl": "string<=240", "capturedAt": "string ISO8601" }], "summary": "string<=480", "sources": ["string<=200"] }`,
        requiredTools: ["web-search"],
        allowedServices: ["web-search"],
      },
      {
        id: "gap-analysis",
        label: "Positioning gap analysis",
        description:
          "Cross-references the competitor map against the chosen positioning to surface 3-5 unclaimed themes with opportunity scores and supporting evidence links.",
        inputSchema: `{ "missionId": "string<=48", "competitors": "array (output of competitor-map)", "ourPositioning": "string<=240" }`,
        outputSchema: `{ "gaps": [{ "theme": "string<=80", "opportunity": "string<=200", "evidenceLinks": ["string<=240"], "confidence": "number 0..1" }], "summary": "string<=480", "sources": ["string<=200"] }`,
        requiredTools: [],
        allowedServices: ["colosseum-copilot"],
      },
    ],
    supportedServices: ["colosseum-copilot", "web-search"],
    evaluationSuiteId: "research-baseline-v1",
    endpointUrl: "https://agents.bifrost.io/competitor-scout",
  },
  {
    id: "launch-copywriter-1",
    slug: "launch-copywriter",
    name: "Launch Copywriter",
    description:
      "Writes conversion-grade landing page copy, FAQ entries, and channel-specific launch posts grounded in the chosen positioning angle. Reads positioning brief, brand tone, must-have section list; emits structured copy JSON consumed verbatim by the Builder agent.",
    icon: "C",
    role: "custom",
    capabilities: [
      {
        id: "landing-copy",
        label: "Landing page copy",
        description:
          "Produces hero, value-prop sections, primary CTA, and waitlist-form copy in a single JSON document, conforming to mission's must-have section list.",
        inputSchema: `{ "missionId": "string<=48", "positioning": "string<=240", "brandTone": "string<=64", "mustHaveSections": ["string<=32"], "primaryCTA": "string<=64" }`,
        outputSchema: `{ "hero": { "headline": "string<=120", "sub": "string<=200" }, "sections": [{ "id": "string<=32", "heading": "string<=120", "body": "string<=600" }], "cta": { "label": "string<=40", "supportingLine": "string<=120" }, "waitlistCopy": "string<=160", "summary": "string<=240", "sources": ["string<=200"] }`,
        requiredTools: [],
        allowedServices: [],
      },
      {
        id: "social-copy",
        label: "Channel launch posts",
        description:
          "Generates one launch post per requested channel (Twitter, LinkedIn, etc.), each within channel-specific length limits and tagged with relevant hashtags.",
        inputSchema: `{ "missionId": "string<=48", "landingCopy": "object (output of landing-copy)", "channels": ["twitter|linkedin|email|reddit"] }`,
        outputSchema: `{ "posts": [{ "channel": "string<=16", "body": "string<=480", "hashtags": ["string<=24"], "characterCount": "number" }], "summary": "string<=240", "sources": ["string<=200"] }`,
        requiredTools: [],
        allowedServices: [],
      },
      {
        id: "faq",
        label: "FAQ pairs",
        description:
          "Produces 4-8 FAQ Q&A pairs addressing known objections and trust signals, each tied back to a section pillar in the landing copy.",
        inputSchema: `{ "missionId": "string<=48", "positioning": "string<=240", "knownObjections": ["string<=160"] }`,
        outputSchema: `{ "faq": [{ "question": "string<=160", "answer": "string<=400", "sourcePillar": "string<=64" }], "summary": "string<=240", "sources": ["string<=200"] }`,
        requiredTools: [],
        allowedServices: [],
      },
    ],
    supportedServices: [],
    evaluationSuiteId: "custom-copywriter-v1",
    endpointUrl: "https://agents.bifrost.io/launch-copywriter",
  },
  {
    id: "launch-builder-1",
    slug: "launch-builder",
    name: "Launch Builder",
    description:
      "Compiles approved copy into a deployable landing-page artifact: HTML, CSS, JS, asset manifest with SHA-256 per file, plus a waitlist form bearing the data-bifrost=waitlist marker required for verifier audits. Reads landing copy JSON; emits a packaged artifact bundle hash.",
    icon: "B",
    role: "execution",
    capabilities: [
      {
        id: "site-generation",
        label: "Static site generation",
        description:
          "Compiles approved landing copy and brand palette into responsive HTML/CSS/JS files with viewport meta and accessibility landmarks, returning a file manifest with SHA-256 hashes.",
        inputSchema: `{ "missionId": "string<=48", "copyJson": "object (output of landing-copy)", "brandPalette": { "primary": "string<=16 hex", "accent": "string<=16 hex" }, "assetUrls": ["string<=240"] }`,
        outputSchema: `{ "files": [{ "path": "string<=240", "contentSha256": "string=64 hex", "byteSize": "number" }], "rootUrl": "string<=240", "summary": "string<=240", "sources": ["string<=200"] }`,
        requiredTools: [],
        allowedServices: [],
      },
      {
        id: "waitlist-form",
        label: "Waitlist form",
        description:
          "Emits an HTML form bearing the required data-bifrost=waitlist attribute and configures the submission endpoint path; verifier audits this attribute on every preview.",
        inputSchema: `{ "missionId": "string<=48", "missionMeta": { "productName": "string<=64", "endpoint": "string<=120" } }`,
        outputSchema: `{ "html": "string<=2400", "attrs": { "dataBifrost": "string='waitlist'" }, "endpointPath": "string<=120", "verificationMarker": "string<=64", "summary": "string<=240" }`,
        requiredTools: [],
        allowedServices: [],
      },
      {
        id: "artifact-packaging",
        label: "Artifact packaging",
        description:
          "Bundles the file manifest into a content-addressed artifact and returns the bundle hash, manifest hash, and file count for downstream verifier and deployer consumption.",
        inputSchema: `{ "missionId": "string<=48", "files": "array (output of site-generation)" }`,
        outputSchema: `{ "bundleHash": "string=64 hex", "manifestSha256": "string=64 hex", "fileCount": "number", "summary": "string<=240" }`,
        requiredTools: [],
        allowedServices: [],
      },
    ],
    supportedServices: [],
    evaluationSuiteId: "execution-baseline-v1",
    endpointUrl: "https://agents.bifrost.io/launch-builder",
  },
  {
    id: "launch-deployer-1",
    slug: "launch-deployer",
    name: "Launch Deployer",
    description:
      "Promotes builder artifacts into preview and live deployments, searches domain candidates within the mission's domain budget cap, and surfaces a signed deploy receipt with TTL. Spend actions require human approval per spend policy.",
    icon: "D",
    role: "execution",
    capabilities: [
      {
        id: "preview-deploy",
        label: "Preview deployment",
        description:
          "Pushes a packaged artifact to the preview hosting service, returning a TTL-bounded preview URL plus a signed deploy receipt the verifier audits.",
        inputSchema: `{ "missionId": "string<=48", "artifactBundleHash": "string=64 hex", "envName": "string='preview'" }`,
        outputSchema: `{ "previewUrl": "string<=240", "deployId": "string<=64", "ttlMinutes": "number 5..1440", "receiptSignature": "string<=128", "summary": "string<=240" }`,
        requiredTools: [],
        allowedServices: ["preview-deploy"],
      },
      {
        id: "live-deploy",
        label: "Live deployment",
        description:
          "After a signed checkpoint, promotes the verified artifact to the live deploy target on a confirmed domain and returns a permanent live URL plus DNS verification record.",
        inputSchema: `{ "missionId": "string<=48", "artifactBundleHash": "string=64 hex", "domain": "string<=120", "envName": "string='live'", "checkpointSignature": "string<=128" }`,
        outputSchema: `{ "liveUrl": "string<=240", "deployId": "string<=64", "dnsRecord": { "name": "string<=120", "type": "string='TXT'", "value": "string<=240" }, "receiptSignature": "string<=128", "summary": "string<=240" }`,
        requiredTools: [],
        allowedServices: ["live-deploy"],
      },
      {
        id: "domain-search",
        label: "Domain candidate search",
        description:
          "Queries registrar APIs for available domain candidates within the mission's stated domain budget cap and returns a ranked candidate list; never purchases without a signed human checkpoint.",
        inputSchema: `{ "missionId": "string<=48", "brandSeed": "string<=64", "budgetCapUsd": "number 0..200" }`,
        outputSchema: `{ "candidates": [{ "domain": "string<=120", "registrar": "string<=64", "priceUsd": "number 0..200", "available": "boolean" }], "summary": "string<=240", "sources": ["string<=200"] }`,
        requiredTools: [],
        allowedServices: ["domain-search"],
      },
    ],
    supportedServices: ["preview-deploy", "live-deploy", "domain-search"],
    evaluationSuiteId: "execution-deploy-v1",
    endpointUrl: "https://agents.bifrost.io/launch-deployer",
  },
  {
    id: "verifier-1",
    slug: "verifier-agent",
    name: "Verifier",
    description:
      "Audits mission deliverables against rule sets — preview reachability, required HTML markers, spend receipt validity, settlement eligibility — and produces a signed verification report. Cannot move funds; only emits verdicts that gate spend and settlement instructions.",
    icon: "V",
    role: "verifier",
    capabilities: [
      {
        id: "preview-verification",
        label: "Preview verification",
        description:
          "Fetches a deployed preview URL, runs an HTML/CSS rule set (page reachable, hero heading present, mission meta tag, data-bifrost=waitlist marker, mobile viewport), and emits a verdict with per-rule evidence snippets.",
        inputSchema: `{ "missionId": "string<=48", "previewUrl": "string<=240", "checklistRuleIds": ["string<=64"] }`,
        outputSchema: `{ "checks": [{ "ruleId": "string<=64", "passed": "boolean", "evidenceSnippet": "string<=240", "fixHint": "string<=240" }], "verdict": "string='pass|reject|needs_review'", "evidenceHash": "string=64 hex", "summary": "string<=240", "sources": ["string<=200"] }`,
        requiredTools: ["http-fetch"],
        allowedServices: [],
      },
      {
        id: "receipt-audit",
        label: "Receipt audit",
        description:
          "Validates spend transaction signatures against expected agent payout routes and the mission's signed approvals, surfacing any unrouted or duplicated receipts.",
        inputSchema: `{ "missionId": "string<=48", "spendTxSignatures": ["string<=128"], "expectedAgentRoutes": ["string<=64"] }`,
        outputSchema: `{ "validReceipts": [{ "txSignature": "string<=128", "agentId": "string<=64", "amountUsdc": "number" }], "discrepancies": [{ "txSignature": "string<=128", "reason": "string<=240" }], "summary": "string<=240" }`,
        requiredTools: ["solana-rpc"],
        allowedServices: [],
      },
      {
        id: "settlement",
        label: "Settlement decision",
        description:
          "Aggregates the verification report and audited receipts into a settlement decision the program consumes inside finalize_allocation; never signs a transfer itself.",
        inputSchema: `{ "missionId": "string<=48", "verificationReport": "object", "auditedReceipts": "array" }`,
        outputSchema: `{ "settlementDecision": "string='settle|hold|dispute'", "rationale": "string<=480", "verifierSignature": "string<=128", "summary": "string<=240" }`,
        requiredTools: [],
        allowedServices: [],
      },
    ],
    supportedServices: [],
    evaluationSuiteId: "verifier-baseline-v1",
    endpointUrl: "https://agents.bifrost.io/verifier",
  },
];

interface SeededAgent {
  id: string;
  wallet: string;
  payoutWallet: string;
  verifierWallet: string;
  agentRegistryPda?: string;
  anchorTx?: string;
  status: "registered" | "skipped" | "failed";
  error?: string;
}

function loadOrCreateKeypair(agentId: string, suffix: string): Keypair {
  if (!existsSync(SEED_DIR)) mkdirSync(SEED_DIR, { recursive: true });
  const path = resolve(SEED_DIR, `${agentId}-${suffix}.json`);
  if (existsSync(path)) {
    const bytes = JSON.parse(readFileSync(path, "utf8")) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(bytes));
  }
  const kp = Keypair.generate();
  writeFileSync(path, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

function buildManifest(spec: SeedSpec, owner: Keypair, payout: Keypair, verifier: Keypair): AgentManifest {
  const signedAt = new Date().toISOString();
  const isExecution = spec.role === "execution";
  return {
    agentId: spec.id,
    slug: spec.slug,
    name: spec.name,
    description: spec.description,
    icon: spec.icon,
    ownerWallet: owner.publicKey.toBase58(),
    payoutWallet: payout.publicKey.toBase58(),
    verifierWallet: verifier.publicKey.toBase58(),
    endpointUrl: spec.endpointUrl,
    role: spec.role,
    executionMode: "builtin",
    capabilities: spec.capabilities.map((cap) => ({
      id: cap.id,
      label: cap.label,
      description: cap.description,
      version: "1.0.0",
      inputSchema: cap.inputSchema,
      outputSchema: cap.outputSchema,
      requiredTools: cap.requiredTools,
      allowedServices: cap.allowedServices,
      evaluationSuiteId: spec.evaluationSuiteId,
    })),
    phaseSchema: [
      { id: "collect_context", label: "Collect context", description: "Gather inputs needed to perform the capability.", streams: false },
      { id: "produce_artifact", label: "Produce artifact", description: "Run the capability logic and emit a verifiable artifact.", streams: true },
    ],
    supportedServices: spec.supportedServices,
    spendPolicy: isExecution
      ? { maxPerCall: 0.5, budgetCap: 5, requiresHumanAbove: 0.01 }
      : { maxPerCall: 0.01, budgetCap: 0.01, requiresHumanAbove: 0.01 },
    priceModel: isExecution
      ? "Per-call USDC settled on Solana; every call ≥ $0.01 requires signed human approval"
      : "No direct spend; signature gate matches max-per-call so any non-zero billing requires human approval",
    requestedEvaluationSuites: [spec.evaluationSuiteId],
    signedAt,
  };
}

async function fetchExisting(): Promise<Set<string>> {
  try {
    const res = await fetch(`${API_BASE}/api/registry`);
    if (!res.ok) return new Set();
    const json = (await res.json()) as { agents: Array<{ id: string; agentRegistryPda?: string }> };
    return new Set(
      json.agents.filter((a) => Boolean(a.agentRegistryPda)).map((a) => a.id),
    );
  } catch {
    return new Set();
  }
}

async function seedOne(spec: SeedSpec): Promise<SeededAgent> {
  const owner = loadOrCreateKeypair(spec.id, "owner");
  const payout = loadOrCreateKeypair(spec.id, "payout");
  const verifier = loadOrCreateKeypair(spec.id, "verifier");
  const wallet = owner.publicKey.toBase58();
  const payoutWallet = payout.publicKey.toBase58();
  const verifierWallet = verifier.publicKey.toBase58();

  const manifest = buildManifest(spec, owner, payout, verifier);
  const issuedAt = new Date().toISOString();
  const message = buildRegistryApplicationAuthorizationMessage(manifest, issuedAt);
  const signature = nacl.sign.detached(new TextEncoder().encode(message), owner.secretKey);
  const sigBase64 = Buffer.from(signature).toString("base64");

  // Step 1: create application
  const createRes = await fetch(`${API_BASE}/api/registry/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ manifest, auth: { issuedAt, signature: sigBase64 } }),
  });
  if (!createRes.ok) {
    const body = await createRes.text();
    return {
      id: spec.id,
      wallet,
      payoutWallet,
      verifierWallet,
      status: "failed",
      error: `create ${createRes.status}: ${body.slice(0, 240)}`,
    };
  }
  const created = (await createRes.json()) as { application: { id: string } };
  const applicationId = created.application.id;

  // Step 2: protocol-check
  const protoRes = await fetch(`${API_BASE}/api/registry/applications/${applicationId}/protocol-check`, {
    method: "POST",
  });
  if (!protoRes.ok) {
    return {
      id: spec.id,
      wallet,
      payoutWallet,
      verifierWallet,
      status: "failed",
      error: `protocol-check ${protoRes.status}: ${(await protoRes.text()).slice(0, 240)}`,
    };
  }

  // Step 3: evaluations (this triggers anchorAgentRegistry → register-agent ix on devnet)
  const evalRes = await fetch(`${API_BASE}/api/registry/applications/${applicationId}/evaluations`, {
    method: "POST",
  });
  if (!evalRes.ok) {
    return {
      id: spec.id,
      wallet,
      payoutWallet,
      verifierWallet,
      status: "failed",
      error: `evaluations ${evalRes.status}: ${(await evalRes.text()).slice(0, 240)}`,
    };
  }
  const evaluated = (await evalRes.json()) as {
    application: {
      id: string;
      status: string;
      agentRegistryPda?: string;
      anchorTxSignature?: string;
    };
  };

  return {
    id: spec.id,
    wallet,
    payoutWallet,
    verifierWallet,
    agentRegistryPda: evaluated.application.agentRegistryPda,
    anchorTx: evaluated.application.anchorTxSignature,
    status:
      evaluated.application.status === "active" || evaluated.application.status === "probation"
        ? "registered"
        : "failed",
    error:
      evaluated.application.status === "active" || evaluated.application.status === "probation"
        ? undefined
        : `eval status: ${evaluated.application.status}`,
  };
}

async function main() {
  console.log(`[seed] target API: ${API_BASE}`);
  const existing = await fetchExisting();
  console.log(`[seed] already-anchored agents: ${existing.size}`);

  const results: SeededAgent[] = [];
  for (const spec of SEED_SPECS) {
    if (existing.has(spec.id)) {
      const owner = loadOrCreateKeypair(spec.id, "owner");
      const payout = loadOrCreateKeypair(spec.id, "payout");
      const verifier = loadOrCreateKeypair(spec.id, "verifier");
      results.push({
        id: spec.id,
        wallet: owner.publicKey.toBase58(),
        payoutWallet: payout.publicKey.toBase58(),
        verifierWallet: verifier.publicKey.toBase58(),
        status: "skipped",
      });
      console.log(`[seed] ${spec.id}: skipped (already registered)`);
      continue;
    }
    process.stdout.write(`[seed] ${spec.id}: registering... `);
    const result = await seedOne(spec);
    results.push(result);
    if (result.status === "registered") {
      console.log(`OK pda=${result.agentRegistryPda?.slice(0, 12)}… tx=${result.anchorTx?.slice(0, 12)}…`);
    } else {
      console.log(`FAIL ${result.error}`);
    }
  }

  writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));
  console.log(`\n[seed] wrote ${OUT_PATH}\n`);
  console.log("=== Paste into packages/shared/src/demo.ts ===\n");
  console.log("// Real on-chain wallets/PDAs from scripts/seed-launch-agents.ts");
  for (const r of results) {
    if (r.status === "failed") {
      console.log(`// ${r.id}: FAILED — ${r.error}`);
      continue;
    }
    console.log(`// ${r.id}:`);
    console.log(`//   wallet:           "${r.wallet}",`);
    console.log(`//   payoutWallet:     "${r.payoutWallet}",`);
    console.log(`//   verifierWallet:   "${r.verifierWallet}",`);
    if (r.agentRegistryPda) console.log(`//   agentRegistryPda: "${r.agentRegistryPda}",`);
    if (r.anchorTx) console.log(`//   anchorTx:         "${r.anchorTx}",`);
  }
}

main().catch((err) => {
  console.error("[seed] fatal:", err);
  process.exit(1);
});
