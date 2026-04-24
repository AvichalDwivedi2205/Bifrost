# MissionMesh Context

Last updated: 2026-04-10

## Available AI Provider Budget / Access

This file tracks which provider accounts or credits are available for product planning.
It does **not** store plaintext API keys, secrets, or credential values.

- Google Cloud / Vertex AI:
  - User has GCP credits available.
  - Treat this as the primary managed provider budget for MissionMesh planning.
- OpenRouter:
  - User has approximately $18 in credits.
  - Good for prototyping, model routing, and low-volume fallback usage.
- AWS Bedrock:
  - User has Bedrock access / budget available.
  - Good as a secondary provider path and for enterprise-compatible fallback.

## Planning Constraints

- Do not assume separate paid OpenAI billing is available.
- Do not assume separate paid Anthropic billing is available outside OpenRouter or Bedrock.
- Prefer architectures that work well with Vertex AI first, then OpenRouter, then Bedrock.
- Keep actual secrets in environment variables or a secrets manager, never in repo files.
