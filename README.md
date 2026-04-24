# Bifrost

Bifrost is a Solana-native mission execution stack for governed multi-agent workflows. This repo is scaffolded as a monorepo with:

- `apps/web`: Next.js frontend inspired by the provided Bifrost UI direction
- `apps/api`: Fastify + LangGraph JS backend with `OpenRouter + Vertex AI` provider adapters
- `packages/shared`: mission, agent, event, receipt, and analytics types shared across the stack
- `program`: native Rust Solana program skeleton for mission vault, spend, verification, settlement, and reputation state

## Stack

- Frontend: Next.js App Router + React
- Backend: Fastify, WebSockets, LangGraph JS
- Model providers: OpenRouter and Vertex AI on GCP
- Wallet connection: `@solana/wallet-adapter-react` + Phantom / Solflare adapters
- Chain client: `@solana/web3.js`
- Program: native Rust with `solana-program` + `borsh`

## Quick start

1. Copy `.env.example` to `.env`.
2. Install workspace dependencies with Bun.
3. Start the API.
4. Start the web app.

```bash
bun install
bun run dev:api
bun run dev:web
```

## Verification

```bash
bun run typecheck
bun run test
bun run build:api
bun run build:web
cargo check --manifest-path program/Cargo.toml
```

## Frontend / backend wiring

- Mission creation uses browser `fetch` to `POST /api/missions`
- Before that POST is sent, the frontend builds a canonical authorization message and asks the connected Solana wallet to `signMessage`
- The API verifies the Ed25519 signature against `authorityWallet` before it creates any mission state
- Live mission updates use WebSockets over `/ws/missions/:missionId`
- The shared client lives in `apps/web/lib/api.ts`
- The backend app factory lives in `apps/api/src/app.ts`
- The API server exposes REST routes from `apps/api/src/routes/missions.ts`
- LangGraph orchestration runs inside `apps/api/src/graph/mission-graph.ts`

## Wallet connection

- The frontend wraps the app in Solana wallet providers from `@solana/wallet-adapter-react`
- The UI wallet button comes from `@solana/wallet-adapter-react-ui`
- Supported wallets are Phantom and Solflare on devnet
- The wallet state is shown in the sidebar and mission deploy requires a connected wallet
- The connected public key is submitted as `authorityWallet` in mission creation payloads
- Mission creation also requires wallet message signing, not just a bare public key string

## Tests included

- API integration test for invalid wallet rejection
- API integration test for invalid signature rejection
- API integration test for expired authorization rejection
- API integration test for create → settle mission flow
- Policy engine unit tests for spend caps and whitelist enforcement
- Policy engine unit test for human-approval threshold enforcement

## Environment

### OpenRouter

- Set `OPENROUTER_API_KEY`
- Optionally change `OPENROUTER_MODEL`

### GCP Vertex AI

- Set `VERTEX_PROJECT_ID`
- Set `GOOGLE_APPLICATION_CREDENTIALS`
- Optionally adjust `VERTEX_LOCATION` and `VERTEX_MODEL`

If neither provider is configured, the backend falls back to an internal mock model provider so the LangGraph workflow and UI can still run in demo mode.

## Current scope

This repo already includes:

- Routed UI pages for dashboard, mission creation, live execution, registry, history, profile, and analytics
- LangGraph mission flow with coordinator, research, risk, execution, verifier, and settlement nodes
- Provider adapters for OpenRouter and Vertex AI
- Bun-first workspace scripts and Bun test coverage
- Solana wallet connection in the frontend
- WebSocket mission streaming
- Shared domain models across frontend and backend
- Native Rust program modules and instruction routing scaffold

The Solana program is intentionally at the scaffold stage: it contains real account/state modules and instruction handlers, but it is not yet wired to a full SPL-token escrow lifecycle or end-to-end program tests.

The API-side Solana transport in `apps/api/src/services/solana/bifrost-client.ts` is also still a mock client that emits realistic PDAs, receipts, and tx-like ids for the demo flow. The frontend/backend connection path is real, the wallet auth is real, and the LangGraph orchestration is real, but actual devnet value movement still needs to be wired into the backend client.
