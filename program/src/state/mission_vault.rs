use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

use crate::state::AccountSize;

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum MissionStatus {
    Created,
    Active,
    Paused,
    Verifying,
    Cancelled,
    Settled,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum PrivacyMode {
    Public,
    PrivateArtifacts,
    PrivateExecution,
    Hybrid,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum VerificationMode {
    Rules,
    Human,
    Verifier,
    Hybrid,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct Mission {
    pub discriminator: [u8; 8],
    pub version: u8,
    pub status: MissionStatus,
    pub privacy_mode: PrivacyMode,
    pub verification_mode: VerificationMode,
    pub mission_bump: u8,
    pub vault_authority_bump: u8,
    pub creator: Pubkey,
    pub mint: Pubkey,
    pub verifier: Pubkey,
    pub mission_ref: [u8; 32],
    pub metadata_hash: [u8; 32],
    pub private_manifest_hash: [u8; 32],
    pub budget_commitment_hash: [u8; 32],
    pub result_hash: [u8; 32],
    pub challenge_window_seconds: i64,
    pub created_at: i64,
    pub activated_at: i64,
    pub funded_amount: u64,
    pub total_budget: u64,
    pub allocated_amount: u64,
    pub spent_amount: u64,
    pub settled_amount: u64,
    pub refunded_amount: u64,
    pub allocation_count: u32,
    pub reserved: [u8; 0],
}

impl AccountSize for Mission {
    const LEN: usize = 410;
    const DISCRIMINATOR: [u8; 8] = *b"MMMSN001";
}
