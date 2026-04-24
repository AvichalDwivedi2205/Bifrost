import path from "node:path";
import { fileURLToPath } from "node:url";

import type { MissionChainState, MissionRecord, SpendReceipt } from "@missionmesh/shared";
import { nanoid } from "nanoid";

import { env } from "../../env";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../../../../");
const programManifestPath = path.join(repoRoot, "program/Cargo.toml");

interface MissionCreateResult {
  missionPda?: string;
  verificationPda?: string;
  vaultAta?: string;
  txSignature: string;
}

export class MissionMeshSolanaClient {
  private readonly localMode =
    env.SOLANA_RPC_URL.includes("127.0.0.1") || env.SOLANA_RPC_URL.includes("localhost");

  describeConnection(): MissionChainState {
    return {
      programId: env.SOLANA_PROGRAM_ID,
      rpcProvider: env.SOLANA_RPC_PROVIDER,
      rpcHttpUrl: env.SOLANA_RPC_URL,
      rpcWsUrl: env.SOLANA_WS_URL,
      rpcStreamingEnabled: Boolean(env.SOLANA_WS_URL),
    };
  }

  async createMission(record: MissionRecord): Promise<MissionCreateResult> {
    if (!this.localMode) {
      return {
        vaultAta: `vault_${record.id}`,
        txSignature: `tx_${nanoid(10)}`,
      };
    }

    const result = await this.runLocalCommand([
      "create-mission",
      "--mission-id",
      record.id,
      "--total-budget",
      toMicros(record.budget.totalBudget).toString(),
    ]);

    return {
      missionPda: result.MISSION_PDA,
      verificationPda: result.VERIFICATION_PDA,
      vaultAta: result.VAULT_ATA,
      txSignature: result.TX ?? `tx_${nanoid(10)}`,
    };
  }

  async prepareMission(record: MissionRecord): Promise<{ txSignature: string }> {
    if (!this.localMode) {
      return { txSignature: `prepare_${record.id}_${nanoid(8)}` };
    }

    const payoutCap = Math.max(
      Math.min(record.budget.totalBudget * 0.08, 0.15),
      0.05,
    );
    const spendBudgetCap = Math.max(
      record.budget.totalBudget - payoutCap,
      record.budget.maxPerCall,
    );

    const result = await this.runLocalCommand([
      "prepare-mission",
      "--mission-id",
      record.id,
      "--spend-budget-cap",
      toMicros(spendBudgetCap).toString(),
      "--payout-cap",
      toMicros(payoutCap).toString(),
      "--max-per-call",
      toMicros(record.budget.maxPerCall).toString(),
    ]);

    return {
      txSignature: result.TX ?? `prepare_${record.id}_${nanoid(8)}`,
    };
  }

  async authorizeSpend(
    record: MissionRecord,
    agentId: string,
    serviceWallet: string,
    amount: number,
    purpose: string,
  ): Promise<SpendReceipt> {
    if (!this.localMode) {
      return {
        receiptId: `receipt_${nanoid(8)}`,
        missionId: record.id,
        agentId,
        serviceWallet,
        amount,
        purpose,
        toolName: serviceWallet,
        timestamp: new Date().toISOString(),
        txSignature: `tx_${nanoid(10)}`,
      };
    }

    const result = await this.runLocalCommand([
      "spend",
      "--mission-id",
      record.id,
      "--amount",
      toMicros(amount).toString(),
      "--purpose",
      purpose,
    ]);

    return {
      receiptId: result.RECEIPT ?? `receipt_${nanoid(8)}`,
      missionId: record.id,
      agentId,
      serviceWallet,
      amount,
      purpose,
      toolName: serviceWallet,
      timestamp: new Date().toISOString(),
      txSignature: result.TX ?? `tx_${nanoid(10)}`,
    };
  }

  async submitVerification(
    record: MissionRecord,
    proofHash: string,
  ): Promise<{ txSignature: string }> {
    if (!this.localMode) {
      return { txSignature: `verify_${record.id}_${proofHash.slice(-6)}` };
    }

    const result = await this.runLocalCommand([
      "verify",
      "--mission-id",
      record.id,
      "--proof-hash",
      proofHash,
    ]);
    return {
      txSignature: result.TX ?? `verify_${record.id}_${proofHash.slice(-6)}`,
    };
  }

  async approveSettlement(record: MissionRecord): Promise<{ txSignature: string }> {
    if (!this.localMode) {
      return { txSignature: `settle_${record.id}_${nanoid(6)}` };
    }

    const result = await this.runLocalCommand([
      "settle",
      "--mission-id",
      record.id,
    ]);
    return {
      txSignature: result.TX ?? `settle_${record.id}_${nanoid(6)}`,
    };
  }

  async updateReputation(
    agentId: string,
    delta: number,
  ): Promise<{ txSignature: string }> {
    if (!this.localMode) {
      return { txSignature: `rep_${agentId}_${delta}_${nanoid(4)}` };
    }

    return { txSignature: `rep_local_${agentId}_${delta}` };
  }

  private async runLocalCommand(args: string[]): Promise<Record<string, string>> {
    const proc = Bun.spawn(
      [
        "cargo",
        "run",
        "--quiet",
        "--manifest-path",
        programManifestPath,
        "--example",
        "missionmesh_local",
        "--",
        ...args,
      ],
      {
        cwd: repoRoot,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          MISSIONMESH_RPC_URL: env.SOLANA_RPC_URL,
          MISSIONMESH_WS_URL: env.SOLANA_WS_URL,
        },
      },
    );

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      throw new Error(stderr.trim() || stdout.trim() || "Local Solana command failed");
    }

    return parseKeyValueOutput(stdout);
  }
}

function parseKeyValueOutput(value: string): Record<string, string> {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, line) => {
      const separator = line.indexOf("=");
      if (separator === -1) {
        return accumulator;
      }

      const key = line.slice(0, separator).trim();
      const lineValue = line.slice(separator + 1).trim();
      accumulator[key] = lineValue;
      return accumulator;
    }, {});
}

function toMicros(amount: number): number {
  return Math.round(amount * 1_000_000);
}
