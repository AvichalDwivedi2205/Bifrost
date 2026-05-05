import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

// MEMO_PROGRAM_ID is well-known
export const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

export type ApprovalFlow = "transaction" | "memo";

// Default to memo. Real tx path is gated until program is deployed.
export const APPROVAL_FLOW: ApprovalFlow =
  (process.env.NEXT_PUBLIC_APPROVAL_FLOW as ApprovalFlow) || "memo";

export interface BuildSpendApprovalTxArgs {
  connection: Connection;
  payer: PublicKey;
  programId: PublicKey;
  missionPda: PublicKey;
  approvalId: string;
  amount: number; // micro-USDC or whatever the program expects; for placeholder just include in memo
}

/**
 * Builds an unsigned Transaction containing a single Memo-program instruction
 * that records the approval id + amount on-chain. This is the "real tx" path
 * placeholder — when the Bifrost program is deployed, replace this with the
 * actual ApproveSpend instruction builder.
 *
 * Returns a Transaction with a fresh recentBlockhash and feePayer set.
 */
export async function buildSpendApprovalTransaction(
  args: BuildSpendApprovalTxArgs,
): Promise<Transaction> {
  const { connection, payer, approvalId, amount } = args;
  const memo = `bifrost.spend-approve.v1|${approvalId}|${amount.toFixed(6)}`;
  const ix = new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
    data: Buffer.from(memo, "utf8"),
  });
  const tx = new Transaction().add(ix);
  tx.feePayer = payer;
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  return tx;
}

/**
 * Build the byte-array message used in the signMessage fallback path.
 * Returns a Uint8Array suitable for `wallet.signMessage()`.
 */
export function buildSignedMemoBytes(message: string): Uint8Array {
  return new TextEncoder().encode(message);
}

/**
 * Helper to encode a signature buffer to base64 (matches the existing auth pattern).
 */
export function encodeSignatureBase64(sig: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(sig).toString("base64");
  // browser fallback
  let binary = "";
  for (let i = 0; i < sig.length; i++) binary += String.fromCharCode(sig[i] ?? 0);
  return btoa(binary);
}
