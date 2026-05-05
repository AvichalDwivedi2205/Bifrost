# Bifrost Demo Integration Plan

Last updated: 2026-04-25

## Current Reality

Bifrost is not only UI. The repo already has:

- A Next.js operator console with wallet connection, mission creation, live mission state, registry, history, profile, and analytics surfaces.
- A Fastify backend with wallet-signed mission creation, wallet-signed approvals, mission state APIs, WebSocket streaming, policy checks, registry application APIs, and LLM provider routing.
- A native Rust Solana program with mission, allocation, spend, verification, dispute, settlement, refund, registry, and reputation instructions.
- Shared types and canonical wallet authorization messages across web and API.
- Local tests for wallet auth, mission execution, policy enforcement, registry certification, and program compilation.

The important demo gap is this:

- Frontend to backend is real.
- Wallet message authorization is real.
- Backend mission orchestration is real enough for demo flow.
- Program primitives exist and compile.
- Remote Solana execution is not real yet. `apps/api/src/services/solana/bifrost-client.ts` uses the local Cargo harness only for localhost RPC, and returns tx-like mock IDs on devnet/custom RPC.
- Registry evaluation and AI judges are currently mocked.
- The core mission flow is still tailored around the Trump Polymarket demo.

## Hackathon Positioning

The strongest pitch is:

> Bifrost is the contract, escrow, verification, and settlement layer for autonomous agent work on Solana.

Do not pitch it as a generic multi-agent dashboard. That space is too mushy. Also avoid being "just x402 for agents" because Colosseum Copilot shows that agentic payments and MCP monetization already have strong adjacent projects, including `mcpay`, `latinum-agentic-commerce`, `mercantill`, `ai-economy-protocol-(aep)`, `solsynapse`, and `agentrunner`.

The sharper lane is mission-level control:

- User funds a mission.
- Bifrost creates policy-bound agent allocations.
- Agents request paid tools or services.
- Human or policy gates approve spends.
- Receipts, outputs, verification proofs, and settlement are anchored.
- Reputation updates follow from verified delivery.

This maps well to Frontier judging: functionality, impact, novelty, UX, open-source composition, and business plan.

## Product Thesis

Autonomous agents need more than wallets. They need contracts for work.

Payments alone answer "can the agent pay?" Bifrost answers:

- What was the agent allowed to do?
- Who approved the spend?
- Was the output delivered?
- What evidence supports settlement?
- What happens if the work is disputed?
- How does reputation carry to the next mission?

The demo should make that difference impossible to miss.

## Priority 0: Choose Demo Mode

Use one of these two paths. Do not split effort.

### Recommended: Local Validator With Real Program Execution

This is the fastest credible path because the local harness already exists.

Required:

- Run a local validator.
- Build/deploy the Bifrost program locally.
- Configure API with local RPC and the generated program id.
- Let the existing backend drive the local harness for create, prepare, spend, verify, and settle.
- Show real local transaction signatures and PDAs in the UI.

Why this wins for demo:

- Real program path.
- Lower risk than devnet deployment.
- Works during recordings.
- Lets judges inspect code and see that the on-chain lifecycle exists.

### Stretch: Devnet Program Client

Required:

- Add a TypeScript instruction builder/client for the native program.
- Deploy program to devnet.
- Add server-side signer configuration for protocol/admin/provider/verifier flows.
- Replace non-local mock returns in `BifrostSolanaClient` with real transactions.
- Add explorer links in UI.

Why this is harder:

- Key management, airdrops, devnet instability, IDL/client generation, and account bootstrap can eat the whole sprint.
- The current program is native Rust/Borsh, not Anchor IDL-first.

## Priority 1: Real On-Chain Mission Lifecycle

Target files:

- `apps/api/src/services/solana/bifrost-client.ts`
- `program/examples/bifrost_local.rs`
- `apps/web/components/live-mission-view.tsx`
- `packages/shared/src/types.ts`

Work:

- Add a chain mode field: `mock`, `local-validator`, `devnet`.
- Surface chain mode explicitly in health and live mission UI.
- Fail loudly if `DEMO_MODE=false` and the Solana client would mock a transaction.
- Add transaction explorer/local logs for mission creation, allocation preparation, spend execution, verification, and settlement.
- Store `missionPda`, `verificationPda`, `vaultAta`, allocation PDA, spend request PDA, and receipt PDA in mission state.
- Add a one-command demo script that starts local validator, deploys program, starts API, and starts web.

Acceptance criteria:

- Creating a mission produces a real local transaction.
- Approving agent selection creates real allocation state.
- Approving each spend executes the program spend path and stores receipt metadata.
- Verification and settlement call the program.
- UI shows no fake `tx_` identifiers in real demo mode.

## Priority 2: Real Agent Outputs

Target files:

- `apps/api/src/agents/*.ts`
- `apps/api/src/providers/llm/*`
- `apps/api/src/services/mission-runner.ts`

Work:

- Configure at least one real provider. Prefer Vertex AI if GCP credentials are available; use OpenRouter as fallback.
- Add a startup health check that reports provider availability without exposing secrets.
- Make each agent output include a stable artifact hash.
- Keep deterministic demo fallback, but label it clearly as fallback.
- Add per-agent raw artifact storage in memory for the demo, then durable storage later.

Acceptance criteria:

- News, market, skeptic, execution, and verifier agents produce live LLM outputs when provider credentials exist.
- Final result contains artifact hashes used by the verifier.
- The UI shows which provider/model produced the result.

## Priority 3: Real Tool Integrations

The Trump Polymarket mission needs at least one real external data path. Otherwise it feels like a synthetic story.

Recommended integrations:

- Polymarket/CLOB or market data endpoint for live markets.
- News/search feed for timestamped event context.
- Solana RPC Fast for mission/account/event reads and sponsor alignment.
- Optional: Helius/Triton Yellowstone stream if event indexing becomes a visible differentiator.

Implementation:

- Create `apps/api/src/tools/market-data.ts`.
- Create `apps/api/src/tools/news-search.ts`.
- Return raw source URLs, timestamps, and hashes.
- Make spend approvals correspond to real tool calls, not only fictional service names.

Acceptance criteria:

- The market agent reads current market data.
- The news agent reads current source data.
- Tool receipts include source refs and content hashes.
- UI can show "paid tool call -> output artifact -> verification proof".

## Priority 4: Registry That Feels Like a Protocol

Target files:

- `apps/api/src/services/evaluation/registry-evaluation-runner.ts`
- `apps/api/src/services/registry-application-store.ts`
- `apps/api/src/routes/registry.ts`
- `apps/web/app/registry/page.tsx`
- `packages/shared/src/demo.ts`

Work:

- Expand demo registry from a tiny fixed cast into a believable agent network.
- Add 18-30 placeholder agents across news, market, skeptic, research, wallet intelligence, risk, compliance, execution, verifier, and custom roles.
- Mark each placeholder clearly with execution mode, trust score, supported services, certification status, phase schema, price model, and verifier compatibility.
- Keep only some agents selectable for the main mission; others should look real but be unavailable, probationary, or pending certification.
- Replace mocked protocol checks with real endpoint probing for callback agents.
- Require agent manifest endpoint to return capabilities and phase schema.
- Add registration checks for:
  - owner wallet, payout wallet, and verifier wallet validity
  - endpoint discovery
  - manifest hash stability
  - capability schema shape
  - declared tool/service whitelist
  - spend caps and human-approval threshold
  - phase schema completeness
  - callback dry-run for callback agents
  - verifier compatibility for agents claiming verification capability
- Add a deterministic sandbox task for one capability.
- Add AI verifier rubric checks that judge whether agent output matches declared capability and mission success criteria.
- Anchor manifest hash, capability hash, and evaluation report hash through the Solana client.
- Show registry certification timeline in UI.

Acceptance criteria:

- Registry page shows a broad network, not only five mission agents.
- Filters can separate active, probation, pending, unavailable, and verifier-compatible agents.
- A new callback agent can register from the UI.
- API probes the callback endpoint.
- The agent runs a small sandbox capability.
- AI verifier returns accepted claims, rejected claims, score, confidence, and evidence refs.
- A certification report hash is anchored.
- The agent becomes selectable in mission setup.

## Priority 4.5: Output Verification Rubric

Current verifier checks final output broadly. For winner-level demo, verification should feel strict and inspectable.

Work:

- Define a shared verification rubric:
  - Does output answer mission objective?
  - Does output satisfy each success criterion?
  - Are source/tool artifacts cited?
  - Are spend receipts present for paid data?
  - Are outputs internally consistent?
  - Are risk flags or uncertainty disclosed?
  - Is final recommendation actionable?
- Make verifier return structured result:
  - `approved`
  - `score`
  - `confidence`
  - `passedChecks`
  - `failedChecks`
  - `missingEvidence`
  - `proofHash`
  - `summary`
- Show this rubric in the live mission verification panel.
- Use failed verifier result to block settlement or move mission to dispute/review state.

Acceptance criteria:

- Bad or incomplete output does not settle cleanly.
- Good output has visible evidence chain from tool call to artifact to proof hash.
- Human can understand why verifier approved or rejected.

## Priority 5: Mission Controls

Currently pause/stop are UI-only. They are high-value because the program already has pause/cancel instructions.

Work:

- Add API routes:
  - `POST /api/missions/:missionId/pause`
  - `POST /api/missions/:missionId/resume`
  - `POST /api/missions/:missionId/cancel`
- Require wallet signatures for all three.
- Wire to program pause/activate/cancel where chain mode supports it.
- Update runner to respect paused/cancelled state.

Acceptance criteria:

- Pause stops runner progress.
- Resume continues from current task.
- Cancel halts and triggers refund path.
- UI buttons no longer lie.

## Priority 6: Winner-Level Demo Polish

Build one end-to-end story, not ten half-stories.

Demo script:

1. Connect wallet.
2. Create a mission with a visible budget and policy.
3. Wallet signs mission authorization.
4. Bifrost creates on-chain mission/vault state.
5. Human approves agent team.
6. Agent requests paid tool call.
7. Human approves spend.
8. Program records spend receipt.
9. Agents generate outputs from real data.
10. Verifier hashes artifacts and submits proof.
11. Mission settles and reputation changes.
12. UI shows a final audit trail with all transaction links.

UI polish:

- Rename fake service labels to real providers when integrated.
- Add explicit "On-chain proof" panel.
- Add "Policy enforced" badges for rejected/approved spends.
- Add an audit timeline export as JSON.
- Remove or wire UI-only controls before recording.
- Keep one primary demo mission, but allow custom objective text.

## Priority 7: Sponsor-Aligned Features

Do not add sponsor logos as decoration. Add sponsor integrations only when they make the mission contract story stronger.

Official Frontier sponsors to consider:

- Primary: Phantom, Altitude.
- Secondary: Coinbase, Privy, Metaplex, Reflect, Arcium, World, Raydium, MoonPay.

Recommended sponsor fit:

- Phantom: keep external wallet signing polished. Add clear signing copy for mission creation, agent selection, spend approval, pause, cancel, and settlement. This is already close and should be treated as a must-have UX path.
- Altitude: frame Bifrost as agent spend controls plus CFO-grade approval logs. Add an "Agent Treasury Controls" panel that shows budget caps, approver, spend purpose, receipts, and remaining funds.
- Privy: optional embedded wallet path for non-crypto operators. Good for business story, but do only after core wallet + chain flow works.
- Arcium: privacy stretch. Add private mission budget commitments or private agent scoring only if there is time. Do not force full confidential compute into the main sprint.
- World: optional human verification for approvals. A strong story if "prove a human approved this spend" can be added cleanly, but not required for core demo.
- Metaplex: optional reputation badge or certification NFT for agents. Nice visual, but lower priority than real settlement.
- Raydium: optional execution venue if the mission becomes DeFi/trading execution. For the current Polymarket-style research flow, use as stretch only.
- MoonPay: optional funding/onramp story. Useful for onboarding, not mission protocol core.
- Coinbase: optional wallet/onramp/distribution story. Do not spend sprint time unless a specific bounty asks for it.
- Reflect: track as possible sponsor/company context, but only integrate if a concrete API/use case appears.

Best sponsor-aligned feature to add now:

> Agent Treasury Controls: every agent gets a capped allocation, every paid tool call needs policy approval, every receipt is anchored, and every final payout/refund has an audit trail.

Why this is worth adding:

- Strengthens main Bifrost thesis.
- Aligns with Phantom signing, Altitude spend controls, Privy onboarding, and Arcium privacy stretch.
- Judges can understand it in 30 seconds.
- It uses code already in repo instead of adding a risky new protocol dependency.

Acceptance criteria:

- Live page shows a treasury/control panel per mission.
- Each spend row shows policy result: allowed service, cap, approver, signature status, receipt, tx.
- Final settlement shows paid amount, refunded amount, protocol fee, and reputation delta.
- No sponsor feature blocks the local-validator end-to-end flow.

## Priority 8: Business Plan Surface

Add a short page or README section with:

- Target customer: teams using AI agents for paid research, trading ops, security workflows, growth ops, and DAO operations.
- Wedge: mission escrow and verified settlement for agent work.
- Revenue: protocol fee on settled missions, paid registry certification, enterprise policy/observability/treasury controls tier.
- Why Solana: cheap high-frequency receipts, fast settlement UX, wallet-native approvals, composability with stablecoins, agents, RPC/indexers, and token extensions.
- Why now: agent wallets are emerging, but agent work contracts are missing.

## Suggested Sprint Order

### Day 1

- Add strict chain mode and no-mock guard.
- Make local validator demo script.
- Surface real/mock chain mode in API and UI.
- Record a local end-to-end baseline.

### Day 2

- Wire pause/cancel/resume.
- Add explorer/local transaction links.
- Store more PDA/account refs in mission state.
- Add Agent Treasury Controls panel.

### Day 3

- Add real LLM provider health.
- Wire one real market data source and one real news/search source.
- Hash artifacts and feed hashes into verification.
- Add final audit JSON export.

### Day 4

- Upgrade registry protocol check from mocked to endpoint probe.
- Add one sandbox callback run.
- Anchor evaluation report hash through local validator path.
- Add optional certification badge or NFT only if Metaplex path is low-risk.

### Day 5

- Polish UX and submission assets.
- Write README demo instructions.
- Record video.
- Add optional Privy, Arcium, World, Raydium, or MoonPay stretch only if core demo is already stable.
- Freeze feature work unless critical bugs appear.

## Definition Of Demo Ready

Bifrost is demo ready when:

- `bun run typecheck` passes.
- `bun run test:api` passes.
- `cargo check --manifest-path program/Cargo.toml` passes.
- One command starts the whole demo stack.
- A new mission can go from wallet signature to on-chain mission creation, spend approval, verification, settlement, and final audit trail.
- The UI clearly distinguishes real chain actions from fallback/demo behavior.
- The pitch is about mission contracts for agent work, not a generic agent dashboard.
