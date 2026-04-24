# Bifrost Feature Inventory

This document describes the current feature set implemented in the Bifrost repository as of April 24, 2026. It covers the web app, API, shared domain model, Solana integration layer, native Rust program, local harnesses, and tests.

The goal of this file is completeness and accuracy. Wherever a surface is present but not fully wired, that is called out explicitly.

## Product Summary

Bifrost is a Solana-oriented mission execution system for governed multi-agent workflows.

At a high level, the repo currently provides:

- A multi-page Next.js frontend for creating, monitoring, and reviewing missions.
- Real Solana wallet connection and message-signature-based authorization in the browser.
- A Fastify backend with mission creation, approval, and live mission state APIs.
- A mission runner that simulates a governed agent workflow with human approval gates.
- A shared type system for missions, agents, approvals, receipts, verification, and analytics.
- A native Rust Solana program that defines mission, allocation, spend, verification, dispute, and reputation primitives.
- Local program harnesses and automated tests for both the API and the Solana program.

## Current Architecture

- `apps/web`: Next.js frontend and operator console.
- `apps/api`: Fastify API, mission runtime, wallet auth verification, WebSocket streaming, and model routing.
- `packages/shared`: Shared types, demo data, and wallet authorization message builders.
- `program`: Native Rust Solana program, local command harness, and program tests.

## Feature Status Legend

- `Implemented`: present in code and actively used.
- `Demo-backed`: visible and functional in the UI, but backed by demo data or mock execution.
- `Scaffolded`: present as code structure or instruction set, but not yet the primary runtime path.
- `UI-only`: visible control with no backend behavior connected yet.
- `Planned`: product and protocol surface is specified here, but implementation work is still pending.

## Frontend Features

### Global App Shell

Status: `Implemented`

- Shared root layout wraps the entire app in a Solana wallet provider.
- Persistent left-hand sidebar navigation for all major sections.
- Global Bifrost branding and Solana Frontier positioning.
- Shared top bar component used across pages.
- Global CSS theme with a custom dashboard-style visual system.
- Wallet status card pinned in the sidebar footer.

### Sidebar Navigation

Status: `Implemented`

- Overview section with `Dashboard`.
- Missions section with `New Mission`, `Live Execution`, and `History`.
- Agents section with `Registry` and `Profile`.
- System section with `Analytics`.
- Active route highlighting based on current pathname.

### Wallet Connection

Status: `Implemented`

- Solana wallet connection via `@solana/wallet-adapter-react`.
- Wallet UI modal via `@solana/wallet-adapter-react-ui`.
- Supported wallets in the current frontend code:
- Phantom
- Solflare
- Auto-connect behavior enabled after prior connection.
- Frontend defaults to `Solana Devnet`.
- Frontend RPC endpoint can be overridden with `NEXT_PUBLIC_SOLANA_RPC_URL`.
- Wallet status panel shows:
- connection status
- shortened public key
- devnet vs custom RPC label
- connect/disconnect button

### Dashboard Page

Status: `Demo-backed`

- Hero section positioning Bifrost as an autonomous agent mission OS.
- Quick action button to launch a new mission.
- Static network badge showing `Devnet`.
- KPI cards for:
- missions complete
- agent tasks run
- total value settled
- verification pass rate
- Recent missions list with status pills.
- On-chain activity panel with example transaction rows.
- Feature cards for:
- native Rust enforcement
- multi-agent mesh
- portable reputation
- Demo mission snapshot showing:
- remaining budget
- verification check count
- receipt count
- Link into the live execution view.

### Create Mission Page

Status: `Implemented`

- Dedicated mission creation route at `/create`.
- Mission creation form component with browser-side state management.
- Redirect to live view after successful mission creation.

### Mission Creation Form

Status: `Implemented`

- Template selector with five choices:
- Trump Polymarket Demo
- Event Trade Research
- Signal Hunt
- Monitoring
- Custom
- Editable mission objective field.
- Editable success criteria field.
- Urgency selector:
- critical
- high
- medium
- low
- Execution mode selector:
- manual assist
- guarded autonomy
- full autonomy
- Inline explanation text for each execution mode.
- Budget controls for:
- total budget
- max per call
- approval trigger
- Approval trigger is displayed but locked to `0` in the demo flow so every spend requires approval.
- Verification mode selector:
- human
- hybrid
- proof
- agent
- Curated registry team preview card using shared registry data.
- Policy summary card showing:
- authority wallet
- template
- budget locked
- whitelisted services
- challenge window
- human approval policy
- agent selection review gate
- Wallet-required warning state when no wallet is connected.
- Inline error rendering for submission failures.

### Browser Wallet Authorization for Mission Creation

Status: `Implemented`

- Browser derives the authority wallet from the connected public key.
- Browser builds a canonical Bifrost authorization message before mission creation.
- Browser requests a `signMessage` signature from the connected wallet.
- Browser base64-encodes the detached signature.
- Browser submits signed mission creation payload to the API.
- If there is no resolvable API base URL, the UI falls back to demo routing and opens the demo mission.

### Live Execution Page

Status: `Implemented`

- Dedicated mission live view route at `/live`.
- Accepts `missionId` through URL search params.
- Top bar shows live execution title and running badge.
- `Pause` and `Stop` buttons are rendered but are currently `UI-only`.

### Live Mission View

Status: `Implemented` with `Demo-backed` fallback

- Loads mission state from the backend when a real API base URL is configured.
- Falls back to demo mission data when no API is configured.
- Subscribes to mission updates over WebSocket when live backend mode is active.
- Generates synthetic rotating timeline events when running in demo fallback mode.
- Displays mission header with:
- mission title
- current status
- execution mode
- verification mode
- elapsed label
- remaining budget
- Human-gated agent selection approval panel when the mission is in `selection_pending`.
- Operator can toggle selected agents from the curated lineup.
- Operator can approve the agent lineup with a fresh wallet signature.
- Pending payment approvals panel when spend approvals are blocked.
- Each spend approval shows:
- service
- amount
- justification
- purpose
- operator note about fresh wallet signature requirement
- approve and reject actions
- Selected agents board showing:
- name
- description
- current status
- current action
- phase-by-phase status
- spend incurred
- trust score
- Task graph showing each task node and current task status.
- Agent phase stream panel showing current phase, current action, and phase history tags.
- Mission timeline panel showing chronological mission events and tx signatures when available.
- Final recommendation panel showing:
- headline
- summary
- key points
- verdict
- confidence
- Budget dashboard with:
- per-agent budget bars
- total spent
- total reserved
- total remaining
- overall spend progress bar
- Latest receipt panel with mission, agent, service, amount, purpose, and tx signature.
- Verification panel with verification checks and statuses.
- Chain and RPC panel showing:
- provider label
- HTTP RPC URL
- streaming enabled flag
- RPC provider note with special wording for RPC Fast
- Settlement state panel with visible milestone progression.
- Settlement note describing refund behavior after settlement.

### Browser Wallet Authorization for Approvals

Status: `Implemented`

- Agent selection approval requires a fresh signed wallet message.
- Spend approval and rejection both require fresh signed wallet messages.
- Frontend validates that:
- a wallet is connected
- the wallet supports message signing
- the connected wallet matches the mission authority wallet
- Frontend produces different canonical messages for:
- agent selection approval
- spend approval decision

### Registry Page

Status: `Implemented` with `Demo-backed` registry seed and mocked evaluation

- Dedicated route at `/registry`.
- API-backed search input for capability, domain, or name.
- Filter chips for domain, trust, and availability.
- Grid of agent cards sourced from the backend registry endpoint.
- Backend registry combines shared demo agents with newly certified registered agents.
- Each card shows:
- icon
- name
- description
- capability tags
- phase tags
- trust score
- mission count
- Register agent button opens a wallet-signed registration form.
- Registration form collects:
- agent name
- capability label
- runtime endpoint URL
- generated owner, payout, and verifier wallet fields from the connected wallet
- generated phase schema and JSON-shaped input/output schemas for the hackathon flow
- Registration flow signs a canonical agent registration message with the connected wallet.
- Registration flow calls the backend to create an application, run protocol checks, and run sandbox evaluation.
- Latest registry applications are displayed with status, certified count, and rejected claim count.
- Certified registered agents display capability certification badges.
- Clicking an agent routes to the shared profile page.

### Profile Page

Status: `Demo-backed`

- Dedicated route at `/profile`.
- Shows detailed profile for the demo news agent.
- Profile header includes:
- icon
- name
- wallet label
- active state
- verifier compatibility badge
- KPI summary for:
- missions
- pass rate
- average spend
- trust
- Role-specific trust block for multiple dimensions.
- Reputation history list with mission labels and deltas.
- `Assign to Mission` button is currently `UI-only`.

### History Page

Status: `Demo-backed`

- Dedicated route at `/history`.
- Summary stats for:
- total missions
- settled missions
- total settled value
- average budget used
- Mission history table with columns for:
- mission
- type
- agents
- spent
- duration
- outcome
- tx signature
- Export CSV button is currently `UI-only`.

### Analytics Page

Status: `Demo-backed`

- Dedicated route at `/analytics`.
- Summary metrics for:
- completion rate
- average duration
- average USDC per mission
- verification pass rate
- Top services used panel with bar-style usage visualization.
- Top agents by trust leaderboard.
- On-chain program instruction counts block showing example usage volume.
- Time range and export buttons are currently `UI-only`.

### Frontend API Client and Fallback Behavior

Status: `Implemented`

- Frontend resolves API base URL from `NEXT_PUBLIC_API_BASE_URL`.
- If no env var is provided and browser is on localhost, it infers `http://localhost:8787`.
- If no API base URL is available, mission reads fall back to demo mission data.
- If no API base URL is available, registry reads fall back to demo registry data.
- WebSocket mission subscription URL is derived from the API base URL.

## API and Backend Features

### Server Boot and Runtime

Status: `Implemented`

- Fastify server with CORS enabled.
- Fastify WebSocket plugin enabled.
- Mission routes registered under `/api/...`.
- Mission streaming endpoint registered under `/ws/...`.
- App factory supports seeding a demo mission record by default.

### Health and Inspection Endpoints

Status: `Implemented`

- `GET /health`
- returns service status
- mission count
- runtime RPC connection description
- `GET /api/demo/dashboard`
- returns all stored missions
- `GET /api/registry`
- returns registry agents from the registry service
- `GET /api/registry/applications`
- returns submitted agent registry applications
- `GET /api/registry/applications/:applicationId`
- returns a registry application and its evaluation state
- `POST /api/registry/applications`
- creates a signed agent registry application
- `POST /api/registry/applications/:applicationId/protocol-check`
- runs mocked deterministic protocol checks
- `POST /api/registry/applications/:applicationId/evaluations`
- runs mocked sandbox and AI evaluation and certifies passing capabilities
- `GET /api/registry/agents/:agentId/evaluations`
- returns evaluation reports for a registered agent
- `GET /api/registry/capabilities`
- returns certified capabilities from registered agents
- `GET /api/missions`
- lists all missions
- `GET /api/missions/:missionId`
- returns one mission or 404

### Mission Creation API

Status: `Implemented`

- `POST /api/missions`
- validates the mission payload with Zod
- validates wallet address format using `@solana/web3.js`
- enforces mission field requirements and numeric relationships
- reconstructs the canonical authorization message on the server
- verifies the detached wallet signature using `tweetnacl`
- enforces a 5-minute authorization window
- creates the mission through the mission runner
- returns the created mission

### Agent Selection Approval API

Status: `Implemented`

- `POST /api/missions/:missionId/selection`
- accepts explicit selected agent IDs or defaults to recommended agents
- verifies the signed authorization message server-side
- transitions the mission from `selection_pending` into active execution
- returns updated mission state

### Spend Approval API

Status: `Implemented`

- `POST /api/missions/:missionId/spend-approvals/:approvalId`
- accepts approve or reject boolean
- verifies the signed authorization message server-side
- resolves the spend approval through the mission runner
- returns updated mission state

### WebSocket Streaming

Status: `Implemented`

- `GET /ws/missions/:missionId`
- validates mission existence before subscribing
- streams the full mission record on every update
- includes the triggering event when available
- closes the socket for unknown missions

### Agent Registry Application API

Status: `Implemented` with `Mocked evaluator`

- Accepts signed agent manifests from wallet owners.
- Verifies owner wallet signatures before creating registry applications.
- Rejects malformed wallet addresses and invalid signatures.
- Stores registry applications in memory for the current hackathon implementation.
- Tracks application lifecycle states:
- submitted
- protocol_check
- sandbox_eval
- active
- probation
- rejected
- Runs deterministic mocked protocol checks for:
- endpoint discovery
- capability claim presence
- budget policy consistency
- receipt contract compatibility
- Runs mocked sandbox evaluation for declared capabilities.
- Produces structured evaluation reports with:
- phase results
- deterministic results
- AI judge results
- verified claims
- rejected claims
- overall score
- report hash
- mock evaluator signature
- mock Solana anchor transaction
- Converts passing applications into registry agents with certified capability metadata.
- Keeps failed or review-needed claims out of the verified capability list.

## Wallet Authorization and Security Features

### Canonical Message Builders

Status: `Implemented`

- Shared helper to build mission creation authorization messages.
- Shared helper to build agent selection approval messages.
- Shared helper to build spend approval decision messages.

### Signature Verification

Status: `Implemented`

- Server decodes base64 signatures.
- Server validates expected Ed25519 signature length.
- Server rehydrates a Solana public key from the submitted authority wallet.
- Server verifies detached signatures against exact reconstructed messages.
- Server rejects:
- invalid timestamps
- expired authorizations
- malformed signatures
- invalid wallet addresses
- mismatched signatures

## Mission Runtime Features

### Mission Store

Status: `Implemented`

- In-memory mission record store.
- Demo mission seeding on startup unless explicitly disabled.
- Mission listing and mission lookup.
- Mission creation with initialized budget, settlement, task, and agent structures.
- Immutable-style mutation helper.
- Event appending helper.
- Per-mission subscription system used by WebSockets.

### Registry Service

Status: `Implemented`

- Returns registry agents from shared demo registry data and certified registry applications.
- Gets single agents by ID.
- Gets multiple agents by ID.
- Converts a registry agent into a runtime agent profile with mission-local state fields.

### Registry Application Store

Status: `Implemented`

- In-memory store for agent registration applications.
- Computes manifest hashes.
- Prevents duplicate applications for the same agent ID.
- Persists protocol check results.
- Persists evaluation reports.
- Persists certified capabilities and rejected claims.
- Converts certified applications into runtime registry agents.

### Policy Engine

Status: `Implemented`

- Validates mission status before authorizing spend.
- Enforces mission-level per-call spend cap.
- Enforces agent-level budget cap.
- Enforces mission remaining budget.
- Enforces service allowlist from the assigned task.
- Returns explicit rejection reasons.
- Marks valid spends as requiring human approval.

### Mission Runner Overview

Status: `Implemented`

- Orchestrates the current end-to-end mission flow used by the API.
- Holds in-flight run tracking to avoid duplicate concurrent runs per mission.
- Stores intermediate artifacts by mission.
- Uses the following role-specific agents:
- news
- market
- skeptic
- execution
- verifier
- Uses a fixed recommended team for the main demo flow.
- Enforces exactly one selected agent for each required role:
- news
- market
- skeptic
- execution
- verifier

### Mission Lifecycle in the Runner

Status: `Implemented`

- Build a default agent selection proposal.
- Build runtime agent profiles from selected registry entries.
- Build a structured mission task list.
- Create a mission in the store.
- Attempt Solana mission creation.
- Transition mission into `selection_pending`.
- Wait for human approval of the proposed lineup.
- Prepare on-chain budget rails after approval.
- Queue asynchronous mission execution.

### Task Definitions in the Runner

Status: `Implemented`

- `task-plan`
- review proposed team
- `task-news`
- build Trump news timeline
- `task-market`
- scan Trump-linked Polymarket markets
- `task-skeptic`
- challenge the trade edge
- `task-execution`
- prepare final recommendation
- `task-verify`
- verify and settle

### Spend Planning in the Runner

Status: `Implemented`

- Predefined spend plan for the news task.
- Predefined spend plan for the market task.
- Predefined spend plan for the skeptic task.
- Each spend plan includes:
- amount
- service
- purpose
- human-readable justification

### Human-in-the-Loop Gating

Status: `Implemented`

- Mission pauses for agent selection approval before execution begins.
- Mission pauses for human approval before each paid tool call.
- Mission can fail if a required payment is rejected.
- Spend approval requests are stored in mission state and surfaced to the UI.

### News Task Runtime

Status: `Implemented`

- Starts and completes agent phases:
- plan timeline
- gather headlines
- synthesize signal
- Calls the NewsAgent via the model router.
- Stores the returned summary, key points, and artifact ref.
- Marks the news task complete.

### Market Task Runtime

Status: `Implemented`

- Requires news output before execution.
- Starts and completes agent phases:
- map contracts
- scan orderflow
- rank markets
- Calls the MarketAgent via the model router.
- Stores returned market output artifact.
- Marks the market task complete.

### Skeptic Task Runtime

Status: `Implemented`

- Requires both news and market outputs before execution.
- Starts and completes agent phases:
- replay timing
- challenge thesis
- score suspicion
- Calls the SkepticAgent via the model router.
- Stores verdict, summary, confidence, and artifact ref.
- Marks the skeptic task complete.

### Execution Task Runtime

Status: `Implemented`

- Requires skeptic output before execution.
- Starts and completes agent phases:
- draft verdict
- package artifact
- Calls the ExecutionAgent via the model router.
- Stores final mission result with:
- verdict
- headline
- summary
- confidence
- key points
- Marks the execution task complete.

### Verification Task Runtime

Status: `Implemented`

- Requires execution output before verification starts.
- Transitions mission to `verifying`.
- Starts and completes verifier phases:
- audit approvals
- check artifacts
- settle onchain
- Calls the VerifierAgent via the model router.
- Submits verification proof hash through the Solana client.
- Stores verification checks and final proof bundle.
- On failure:
- mission becomes failed
- verifier rejection events are emitted
- task and phase failure state is stored
- On success:
- mission becomes settled
- settlement amounts are stored
- reputation deltas are computed
- settlement and reputation events are emitted
- verification and settlement tx hashes are appended to the mission proof

### Mission Events

Status: `Implemented`

- Mission created
- Mission failed
- Selection proposed
- Selection approved
- Selection changed
- Agent selected
- Agent phase started
- Agent phase updated
- Agent phase completed
- Agent phase failed
- Task started
- Task complete
- Spend requested
- Spend approved
- Spend rejected
- Spend approval required
- Verification running
- Verification approved
- Verification rejected
- Settlement released
- Reputation updated

## LLM and Agent Features

### Model Router

Status: `Implemented`

- Attempts providers in order:
- OpenRouter
- Vertex AI
- Mock provider
- Skips real providers that are not configured.
- Falls back to internal mock provider when real providers are unavailable.
- Supports both text and parsed-object generation.
- Strips JSON code fences before parsing.

### Individual Agent Roles

Status: `Implemented`

- CoordinatorAgent
- breaks a mission into deterministic tasks
- present in code, used by LangGraph scaffold
- ResearchAgent
- summarizes wallet context, suspicious counterparties, and exposure
- used by LangGraph scaffold
- NewsAgent
- generates Trump-related public signal summaries
- used by the current mission runner
- MarketAgent
- generates market structure and price movement summaries
- used by the current mission runner
- SkepticAgent
- challenges the thesis and returns a verdict
- used by the current mission runner
- RiskAgent
- computes risk score and whether simulation is needed
- used by LangGraph scaffold
- ExecutionAgent
- generates the final recommendation artifact
- used by the current mission runner
- VerifierAgent
- checks outputs against success criteria and emits proof data
- used by the current mission runner

### Mock LLM Behavior

Status: `Implemented`

- Internal mock provider allows the app and mission flow to run without external model credentials.
- Supports local testing of orchestration and UI without OpenRouter or Vertex AI.

### Registry Evaluation Runner

Status: `Implemented` with `Mocked evaluator`

- Runs capability-agnostic deterministic checks over registry applications.
- Treats protocol, schema, budget, and receipt failures as hard failures.
- Runs mocked AI judge profiles for:
- strict correctness
- adversarial skepticism
- Produces structured AI verdicts with score, confidence, accepted claims, rejected claims, and evidence refs.
- Aggregates deterministic and AI scores into an overall score.
- Certifies capability claims only when hard checks pass and AI judgment clears review thresholds.
- Calls the Solana integration layer to produce a mock agent registry anchor transaction for passing applications.

## LangGraph Workflow

Status: `Scaffolded`

- Repository includes a full LangGraph state definition and graph compiler.
- Graph nodes cover:
- plan mission
- run research
- run risk
- run execution
- run verification
- settle mission
- Graph persists updates into the same mission store model.
- Graph includes spend authorization and settlement logic.
- This graph is present and reasonably complete, but the primary API runtime currently uses `MissionRunner` rather than this graph as the active mission execution engine.

## Solana Integration Layer

### BifrostSolanaClient

Status: `Implemented` with `Mocked remote mode`

- Reports runtime connection details to the API and UI.
- Supports two operating modes:
- local mode when `SOLANA_RPC_URL` points to localhost or 127.0.0.1
- non-local mode for devnet or custom remote RPC
- In non-local mode:
- returns synthetic mission, verification, settlement, and receipt identifiers
- does not execute real on-chain value movement for the API mission flow
- In local mode:
- shells out to the Rust example harness `bifrost_local`
- supports command verbs:
- `create-mission`
- `prepare-mission`
- `spend`
- `verify`
- `settle`
- Supports mocked agent registry anchoring for certified applications in non-local mode.
- Local agent registration anchoring is represented as a stubbed local transaction until the harness exposes a dedicated register-agent command.

### Connection Metadata

Status: `Implemented`

- Exposes:
- program ID
- RPC provider label
- HTTP RPC URL
- WebSocket RPC URL
- streaming enabled flag

## Native Rust Solana Program Features

### Program Style

Status: `Implemented`

- Written as a native Solana program without Anchor.
- Uses explicit Borsh instruction serialization.
- Uses explicit PDA derivation helpers.
- Uses explicit account owner, signer, and token validation.

### Program Accounts and State Types

Status: `Implemented`

- `ProtocolConfig`
- global admin config
- treasury
- allowed mint
- protocol fee bps
- pause flags
- `AgentRegistry`
- agent identity
- payout wallet
- verifier
- capability hash
- metadata hash
- privacy policy hash
- `AgentReputation`
- missions completed
- missions failed
- total earned
- total tool spend
- disputes won
- disputes lost
- `Mission`
- mission lifecycle state
- privacy mode
- verification mode
- creator
- mint
- verifier
- metadata hashes
- budget and settlement counters
- challenge window
- `Allocation`
- per-agent spend and payout caps
- max per call
- human approval threshold
- policy commitment hash
- `ProviderPolicy`
- per-provider caps within an allocation
- provider active or disabled state
- `SpendRequest`
- request lifecycle
- provider
- amount
- purpose hash
- approval and expiry timestamps
- `SpendReceipt`
- executed spend record
- request link
- provider
- agent
- memo hash
- tx ref hash
- amount
- `VerificationRecord`
- approved, rejected, or challenged proof state
- artifact hash
- proof hash
- output hash
- challenge window end
- `DisputeRecord`
- dispute lifecycle around challenged verification

### Program Instructions

Status: `Implemented`

- Protocol administration:
- initialize protocol
- update protocol
- Agent administration:
- register agent
- update agent
- Mission lifecycle:
- create mission
- fund mission
- activate mission
- pause mission
- cancel mission
- refund mission
- Allocation lifecycle:
- create allocation
- upsert provider policy
- settle allocation
- finalize allocation
- Spend lifecycle:
- request spend
- approve spend
- execute spend
- Verification lifecycle:
- submit verification
- challenge verification
- resolve dispute

### Program Enforcement Features

Status: `Implemented`

- Mint allowlist enforcement from protocol config.
- Protocol pause flag for mission creation.
- Protocol pause flag for agent registration.
- Signer enforcement for admin, creator, agent, verifier, and actor roles.
- PDA validation for all major program-derived accounts.
- SPL token account owner and mint validation.
- Mission funding must match the declared total budget before activation.
- Allocation totals cannot exceed mission budget.
- Provider policy caps cannot exceed allocation caps.
- Per-call cap enforcement.
- Spend requests must be approved before execution.
- Spend request expiry enforcement.
- Challenge window enforcement for verification disputes.
- Settlement and refund state transition checks.
- Reputation PDA updates through a dedicated helper.

### Program Event Emission

Status: `Implemented`

- Mission created
- Mission funded
- Allocation created
- Spend executed
- Verification submitted
- Allocation settled
- Mission refunded

### Program Errors

Status: `Implemented`

- Custom error enum with explicit variants for signer failures, ownership failures, PDA mismatches, invalid state transitions, budget problems, approval problems, verification problems, dispute problems, protocol pause conditions, mint issues, and allocation finalization issues.

## Local Program Harness and Examples

### `bifrost_local` Example

Status: `Implemented`

- Bootstraps a local test environment for the program.
- Creates or loads local keypairs for mint, verifier, agent, provider, and treasury.
- Ensures ATAs exist for creator, agent, provider, and treasury.
- Mints local test balance when needed.
- Initializes protocol if needed.
- Registers a default agent if needed.
- Supports CLI commands used by the backend local mode:
- create mission
- prepare allocation
- execute spend
- submit verification
- settle and refund
- debug mission

### `surfpool_smoke` Example

Status: `Implemented`

- End-to-end smoke harness against a local validator.
- Covers the major mission, allocation, spend, verification, dispute, and settlement flows.

## Test Coverage

### API Tests

Status: `Implemented`

- Rejects mission creation with invalid wallet.
- Rejects mission creation with invalid signature.
- Rejects mission creation with expired authorization.
- Creates a mission and waits for human agent approval.
- Runs a mission end-to-end with human approval before every spend.
- Registers and certifies a callback agent capability.
- Rejects registry applications with invalid owner signatures.

### Policy Engine Tests

Status: `Implemented`

- Rejects spend above per-call cap.
- Rejects non-whitelisted services.
- Marks valid spend as requiring human approval.

### Program Tests

Status: `Implemented`

- Program test suite exists in `program/tests/bifrost.rs`.
- Covers protocol initialization and updates.
- Covers mission creation and lifecycle checks.
- Covers allocation and provider policy behavior.
- Covers spend request, approval, and execution behavior.
- Covers verification, challenge, dispute, settlement, and refund flows.
- Covers agent and reputation state flows.

## Shared Domain Model Features

Status: `Implemented`

- Shared mission status model.
- Shared execution and verification mode enums.
- Shared urgency, agent role, task status, approval status, and phase status enums.
- Shared mission input type.
- Shared task type.
- Shared agent registry and agent profile types.
- Shared spend approval and receipt types.
- Shared selection proposal type.
- Shared verification, proof, result, settlement, and reputation delta types.
- Shared mission event union with many event variants.
- Shared mission chain state type for UI inspection.
- Shared analytics overview type.
- Shared demo data for:
- mission input
- registry agents
- runtime agents
- tasks
- receipts
- spend approvals
- verification checks
- mission events
- mission record
- analytics overview

## Planned Agent Registry and Evaluation Protocol

Status: `Implemented` for hackathon mocked flow, `Planned` for real callback probing and durable persistence

This section captures the intended end-state for self-serve agent registration and capability certification. The current implementation now includes wallet-signed applications, in-memory registry application storage, mocked protocol checks, mocked sandbox evaluation, mocked AI evaluation, certified capability metadata, and registry UI integration. Real callback probing, durable persistence, indexer-backed registry reads, and full on-chain registration writes are still planned.

### Registry Design Goal

Status: `Planned`

- Treat the registry as a claim verification system, not just a directory of agents.
- Allow any agent type to register, not only the current demo news, market, skeptic, execution, and verifier agents.
- Model the registry around certified capabilities rather than fixed roles.
- Store rich agent metadata, test evidence, phase history, and evaluation reports off-chain.
- Store compact identity, payout, verifier, capability, metadata, and privacy policy hashes on-chain.
- Separate unverified agent claims from verified registry claims shown to users.

### Agent Manifest

Status: `Implemented`

- Introduce a signed `AgentManifest` submitted by the agent owner.
- Manifest fields should include:
- agent ID
- owner wallet
- payout wallet
- verifier wallet or verifier policy
- endpoint URL
- execution mode
- declared role or custom role
- declared capabilities
- input schema
- output schema
- phase schema
- allowed tools and external services
- spend policy
- price model
- metadata URI
- privacy policy URI
- requested evaluation suites
- timestamp and owner signature
- Hash the manifest and related policy documents for on-chain anchoring.

### Agent Runtime Protocol

Status: `Planned` with mocked compatibility checks implemented

- Require registered callback agents to expose a small Bifrost-compatible HTTP interface.
- Intended endpoints:
- `GET /.well-known/bifrost-agent.json`
- `POST /quote`
- `POST /run`
- `GET /runs/:id`
- `POST /cancel`
- `GET /receipts/:id`
- Require signed Bifrost requests and signed agent responses.
- Require deterministic run IDs, explicit phase updates, structured artifacts, and spend receipts.
- Require callback agents to respect mission budget, allowlist, timeout, cancellation, and human approval constraints.

### Registration Lifecycle

Status: `Implemented` for submitted, protocol_check, sandbox_eval, active, probation, and rejected states

- `submitted`: manifest is received and signature is valid.
- `protocol_check`: endpoint shape, authentication, quote, run, cancel, and receipt behavior are tested.
- `sandbox_eval`: agent runs against simulated missions with no user funds at risk.
- `certified`: agent passes minimum evaluation threshold for one or more declared capabilities.
- `active`: agent can be selected for live missions.
- `probation`: agent has drifted, failed recent live missions, or is under review.
- `suspended`: agent is blocked due to failed evaluations, invalid receipts, policy violations, or malicious behavior.

### Capability-Centric Certification

Status: `Implemented` with mocked sandbox certification

- Allow one agent to hold many independently certified capabilities.
- Certify each capability against its own input schema, output schema, tool permissions, and evaluation suite.
- Track certification per capability rather than giving the whole agent a single blanket approval.
- Intended capability state fields:
- capability ID
- capability version
- input schema hash
- output schema hash
- evaluation suite ID
- latest score
- certification status
- latest report hash
- expiry or re-evaluation time
- Support generic capabilities such as code editing, research, design review, data analysis, legal drafting, lead generation, monitoring, trading analysis, verification, and custom user-defined skills.

### Deterministic Evaluation

Status: `Implemented` with mocked deterministic checks

- Add hard tests that do not depend on AI judgment.
- Protocol tests should verify endpoint reachability, schema validity, signed messages, deterministic run IDs, cancellation, timeouts, and receipt shape.
- Budget tests should verify per-call caps, mission caps, allowlists, approval gates, and quote-to-receipt consistency.
- Security tests should verify prompt injection resistance, replay protection, forged receipt rejection, malicious tool response handling, overbilling prevention, and data exfiltration boundaries.
- Capability tests should use task-specific fixtures and hidden cases for the capability being certified.
- Any hard security, signing, receipt, or budget failure should override aggregate scoring and fail the certification.

### AI Evaluation

Status: `Implemented` with mocked AI judge profiles

- Add AI-assisted evaluation for fuzzy quality checks that deterministic tests cannot fully judge.
- AI judges should evaluate usefulness, factual support, reasoning quality, hallucinated evidence, source faithfulness, task adherence, and whether the output satisfies mission success criteria.
- Use multiple evaluator profiles when possible, such as strict correctness judge, adversarial skeptic judge, and domain judge.
- Require AI evaluators to produce structured verdicts with scores, confidence, cited evidence references, accepted claims, rejected claims, and review notes.
- Route low-confidence or high-stakes AI judgments to human review before certification.
- Never allow AI evaluation alone to override hard protocol, budget, receipt, or security failures.

### Evaluation Reports

Status: `Implemented`

- Persist every evaluation run as a structured `EvaluationReport`.
- Reports should include:
- agent ID
- manifest hash
- suite ID
- run ID
- started and completed timestamps
- per-phase results
- deterministic test results
- AI evaluation results
- artifacts and log hashes
- claims verified
- claims rejected
- overall score
- pass or fail verdict
- evaluator identity
- report signature
- Surface evaluation reports in the registry so users can inspect what was actually proven.

### Registry UI Additions

Status: `Implemented` for hackathon flow, `Planned` for detailed per-agent report pages

- Replace the current UI-only `Register agent` action with a real registration flow.
- Add a registration form for manifest fields, endpoint URL, wallets, capability claims, schemas, phases, tools, services, and price model.
- Add an evaluation progress view with lifecycle phases and pass or fail results.
- Show capability-level certification badges on registry cards.
- Show rejected claims separately from verified claims.
- Add per-agent pages for evaluation history, live mission history, disputes, receipts, and re-evaluation status.
- Add user-facing warnings for uncertified, expired, probation, or suspended agents.

### API Additions

Status: `Implemented`

- Registry application endpoints:
- `POST /api/registry/applications`
- `GET /api/registry/applications/:applicationId`
- `POST /api/registry/applications/:applicationId/protocol-check`
- `POST /api/registry/applications/:applicationId/evaluations`
- `GET /api/registry/agents/:agentId/evaluations`
- `GET /api/registry/capabilities`
- In-memory persistence exists for applications, manifests, capability claims, evaluation reports, and certification state.
- Mocked evaluation runner exists for hackathon demo purposes.
- Durable persistence and real sandbox workers remain planned after the demo path is stable.

### Solana Integration Additions

Status: `Scaffolded`

- API registration currently produces mocked registry anchor transactions through the Solana client.
- Direct API wiring to the existing native `register_agent` and `update_agent` instructions remains planned.
- Use on-chain agent registry accounts as the canonical anchor for identity, payout wallet, verifier, and metadata hashes.
- Keep rich metadata and evaluation reports off-chain, with hashes committed on-chain.
- Add indexer or API lookup support so registry pages can resolve on-chain agent accounts into full off-chain profiles.
- Add future dispute and slashing hooks for agents that falsify claims, forge receipts, or violate budget constraints.

### Test Plan

Status: `Implemented` for API lifecycle tests, `Planned` for frontend and full program coverage

- API tests cover signed application creation, mocked protocol check, mocked evaluation pass, registry certification output, and invalid owner signature rejection.
- Additional shared type tests, mocked eval fail tests, frontend tests, and program or harness tests remain planned.

## Important Current Limitations

These are real constraints in the current codebase and should be understood as part of the feature inventory.

- The frontend wallet connect and signature flow is real.
- The API-side remote Solana integration is still mostly mocked outside localhost mode.
- The main live mission flow is tailored around a specific Trump and Polymarket demo scenario.
- Many dashboard, history, registry, profile, and analytics views are driven by shared demo data rather than live backend queries.
- Pause, stop, assign to mission, export CSV, and some filter controls are currently UI-only.
- Self-serve agent registration and capability certification now exist as a hackathon flow, but protocol checks, sandbox evaluation, AI evaluation, and Solana anchoring are mocked.
- Evaluation report browsing is available through API responses, but detailed report pages are not yet implemented.
- The LangGraph workflow exists but is not the primary mission runtime used by the main API path.
- The native Solana program is substantial and tested, but the README correctly describes the overall system as not yet wired to a fully real end-to-end devnet escrow lifecycle in the API flow.

## What Is Already Real vs Simulated

### Real Today

- Wallet connection in the browser.
- Wallet message signing for create, selection approval, and spend approval flows.
- Server-side signature verification.
- Mission creation API and mission state management.
- Human approval gates.
- WebSocket mission streaming.
- Native Rust program instruction and account model.
- Local validator program execution through the Rust harness.

### Simulated or Mocked Today

- Most non-local Solana execution in the API mission flow.
- Most dashboard and analytics metrics.
- Some registry filter controls.
- Real external agent callback probing.
- Durable registry persistence.
- Real sandbox workers for capability evaluation.
- Real AI evaluator calls for registry certification.
- Real on-chain agent registration from the API.
- Some surface-level page actions and controls.
- LLM responses when no real model provider is configured.

## Practical Summary

If you run the repo locally today, the complete operator experience you can exercise is:

- connect a Phantom or Solflare wallet on devnet
- create a mission with a signed authorization
- review and approve a curated agent lineup
- approve or reject each paid tool request with fresh wallet signatures
- watch mission state stream live over WebSockets
- inspect tasks, phases, receipts, verification checks, and settlement data in the UI

If you switch the backend to local validator mode, the Solana client can drive the native Rust program through the local command harness. If you stay on devnet or another non-local RPC, the mission flow remains real at the wallet-auth level but uses mocked Solana execution artifacts for the rest of the backend mission lifecycle.
