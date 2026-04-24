import { config } from "dotenv";
import { z } from "zod";

config();

const rawEnvSchema = z.object({
  PORT: z.coerce.number().default(8787),
  HOST: z.string().default("0.0.0.0"),
  API_BASE_URL: z.string().default("http://localhost:8787"),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("google/gemini-2.5-flash"),
  VERTEX_PROJECT_ID: z.string().optional(),
  VERTEX_LOCATION: z.string().default("us-central1"),
  VERTEX_MODEL: z.string().default("gemini-2.5-pro"),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  SOLANA_RPC_URL: z.string().default("https://api.devnet.solana.com"),
  SOLANA_WS_URL: z.string().optional(),
  SOLANA_RPC_PROVIDER: z.string().optional(),
  RPCFAST_HTTP_URL: z.string().optional(),
  RPCFAST_WS_URL: z.string().optional(),
  SOLANA_PROGRAM_ID: z.string().default("MissionMesh11111111111111111111111111111111"),
  DEMO_MODE: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
});

const rawEnv = rawEnvSchema.parse(process.env);
const resolvedRpcUrl = rawEnv.RPCFAST_HTTP_URL ?? rawEnv.SOLANA_RPC_URL;
const resolvedWsUrl =
  rawEnv.RPCFAST_WS_URL ??
  rawEnv.SOLANA_WS_URL ??
  inferWebSocketUrl(resolvedRpcUrl);

export const env = {
  ...rawEnv,
  SOLANA_RPC_URL: resolvedRpcUrl,
  SOLANA_WS_URL: resolvedWsUrl,
  SOLANA_RPC_PROVIDER:
    rawEnv.SOLANA_RPC_PROVIDER ?? inferRpcProvider(resolvedRpcUrl),
};

function inferRpcProvider(rpcUrl: string): string {
  if (rpcUrl.includes("127.0.0.1") || rpcUrl.includes("localhost")) {
    return "localnet";
  }
  if (rpcUrl.toLowerCase().includes("rpcfast")) {
    return "rpcfast";
  }
  if (rpcUrl.includes("api.devnet.solana.com")) {
    return "solana-devnet";
  }
  return "custom";
}

function inferWebSocketUrl(rpcUrl: string): string {
  if (rpcUrl.startsWith("https://")) {
    return rpcUrl.replace("https://", "wss://");
  }
  if (rpcUrl.startsWith("http://")) {
    return rpcUrl.replace("http://", "ws://");
  }
  return rpcUrl;
}
