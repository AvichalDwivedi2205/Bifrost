use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

use crate::state::AccountSize;

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum SpendStatus {
    Pending,
    Approved,
    Executed,
    Rejected,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct SpendRequest {
    pub discriminator: [u8; 8],
    pub version: u8,
    pub status: SpendStatus,
    pub bump: u8,
    pub reserved0: u8,
    pub mission: Pubkey,
    pub allocation: Pubkey,
    pub agent: Pubkey,
    pub provider: Pubkey,
    pub request_ref: [u8; 32],
    pub purpose_hash: [u8; 32],
    pub amount: u64,
    pub requested_at: i64,
    pub approved_at: i64,
    pub expires_at: i64,
    pub reserved: [u8; 32],
}

impl AccountSize for SpendRequest {
    const LEN: usize = 268;
    const DISCRIMINATOR: [u8; 8] = *b"MMREQ001";
}
