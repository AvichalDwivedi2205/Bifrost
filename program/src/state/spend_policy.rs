use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

use crate::state::AccountSize;

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum AllocationStatus {
    Active,
    Frozen,
    Settled,
    Cancelled,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct Allocation {
    pub discriminator: [u8; 8],
    pub version: u8,
    pub status: AllocationStatus,
    pub bump: u8,
    pub reserved0: u8,
    pub mission: Pubkey,
    pub agent: Pubkey,
    pub payout_wallet: Pubkey,
    pub allocation_ref: [u8; 32],
    pub spend_budget_cap: u64,
    pub spend_amount: u64,
    pub payout_cap: u64,
    pub payout_amount: u64,
    pub max_per_call: u64,
    pub human_approval_above: u64,
    pub provider_count: u32,
    pub policy_commitment_hash: [u8; 32],
}

impl AccountSize for Allocation {
    const LEN: usize = 224;
    const DISCRIMINATOR: [u8; 8] = *b"MMALC001";
}
