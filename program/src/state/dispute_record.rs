use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

use crate::state::AccountSize;

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum DisputeStatus {
    Open,
    ResolvedUpheld,
    ResolvedRejected,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct DisputeRecord {
    pub discriminator: [u8; 8],
    pub version: u8,
    pub status: DisputeStatus,
    pub bump: u8,
    pub outcome: u8,
    pub mission: Pubkey,
    pub verification: Pubkey,
    pub challenger: Pubkey,
    pub resolver: Pubkey,
    pub reason_hash: [u8; 32],
    pub opened_at: i64,
    pub resolved_at: i64,
    pub reserved: [u8; 76],
}

impl AccountSize for DisputeRecord {
    const LEN: usize = 264;
    const DISCRIMINATOR: [u8; 8] = *b"MMDSP001";
}
