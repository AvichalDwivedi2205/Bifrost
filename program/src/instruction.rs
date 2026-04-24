use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

use crate::state::{PrivacyMode, VerificationMode};

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct InitializeProtocolArgs {
    pub treasury: Pubkey,
    pub allowed_mint: Pubkey,
    pub protocol_fee_bps: u16,
    pub mission_creation_paused: bool,
    pub agent_registration_paused: bool,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct UpdateProtocolArgs {
    pub treasury: Pubkey,
    pub allowed_mint: Pubkey,
    pub protocol_fee_bps: u16,
    pub mission_creation_paused: bool,
    pub agent_registration_paused: bool,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct RegisterAgentArgs {
    pub metadata_hash: [u8; 32],
    pub capability_hash: [u8; 32],
    pub verifier: Pubkey,
    pub privacy_policy_hash: [u8; 32],
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct UpdateAgentArgs {
    pub metadata_hash: [u8; 32],
    pub capability_hash: [u8; 32],
    pub verifier: Pubkey,
    pub privacy_policy_hash: [u8; 32],
    pub active: bool,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct CreateMissionArgs {
    pub mission_ref: [u8; 32],
    pub metadata_hash: [u8; 32],
    pub private_manifest_hash: [u8; 32],
    pub budget_commitment_hash: [u8; 32],
    pub verifier: Pubkey,
    pub total_budget: u64,
    pub privacy_mode: PrivacyMode,
    pub verification_mode: VerificationMode,
    pub challenge_window_seconds: i64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct FundMissionArgs {
    pub amount: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct CreateAllocationArgs {
    pub allocation_ref: [u8; 32],
    pub spend_budget_cap: u64,
    pub payout_cap: u64,
    pub max_per_call: u64,
    pub human_approval_above: u64,
    pub policy_commitment_hash: [u8; 32],
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct UpsertProviderPolicyArgs {
    pub per_call_cap: u64,
    pub total_cap: u64,
    pub active: bool,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct RequestSpendArgs {
    pub request_ref: [u8; 32],
    pub purpose_hash: [u8; 32],
    pub amount: u64,
    pub ttl_seconds: i64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct ApproveSpendArgs {
    pub approve: bool,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct ExecuteSpendArgs {
    pub memo_hash: [u8; 32],
    pub tx_ref_hash: [u8; 32],
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct SubmitVerificationArgs {
    pub artifact_hash: [u8; 32],
    pub proof_hash: [u8; 32],
    pub output_hash: [u8; 32],
    pub approved: bool,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct ChallengeVerificationArgs {
    pub reason_hash: [u8; 32],
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct ResolveDisputeArgs {
    pub uphold_verification: bool,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct SettleAllocationArgs {
    pub amount: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct FinalizeAllocationArgs {
    pub successful: bool,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct RefundMissionArgs {
    pub amount: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub enum MissionInstruction {
    InitializeProtocol(InitializeProtocolArgs),
    UpdateProtocol(UpdateProtocolArgs),
    RegisterAgent(RegisterAgentArgs),
    UpdateAgent(UpdateAgentArgs),
    CreateMission(CreateMissionArgs),
    FundMission(FundMissionArgs),
    ActivateMission,
    PauseMission,
    CancelMission,
    CreateAllocation(CreateAllocationArgs),
    UpsertProviderPolicy(UpsertProviderPolicyArgs),
    RequestSpend(RequestSpendArgs),
    ApproveSpend(ApproveSpendArgs),
    ExecuteSpend(ExecuteSpendArgs),
    SubmitVerification(SubmitVerificationArgs),
    ChallengeVerification(ChallengeVerificationArgs),
    ResolveDispute(ResolveDisputeArgs),
    SettleAllocation(SettleAllocationArgs),
    FinalizeAllocation(FinalizeAllocationArgs),
    RefundMission(RefundMissionArgs),
}
