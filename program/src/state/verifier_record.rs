use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

use crate::state::AccountSize;

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum VerificationStatus {
    Pending,
    Approved,
    Rejected,
    Challenged,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct VerificationRecord {
    pub discriminator: [u8; 8],
    pub version: u8,
    pub status: VerificationStatus,
    pub bump: u8,
    pub reserved0: u8,
    pub mission: Pubkey,
    pub verifier: Pubkey,
    pub artifact_hash: [u8; 32],
    pub proof_hash: [u8; 32],
    pub output_hash: [u8; 32],
    pub challenged_by: Pubkey,
    pub verified_at: i64,
    pub challenge_window_end: i64,
    pub reserved: [u8; 44],
}

impl AccountSize for VerificationRecord {
    const LEN: usize = 264;
    const DISCRIMINATOR: [u8; 8] = *b"MMVER001";
}
