use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

use crate::state::AccountSize;

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProviderStatus {
    Active,
    Disabled,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct ProviderPolicy {
    pub discriminator: [u8; 8],
    pub version: u8,
    pub status: ProviderStatus,
    pub bump: u8,
    pub reserved0: u8,
    pub allocation: Pubkey,
    pub provider: Pubkey,
    pub per_call_cap: u64,
    pub total_cap: u64,
    pub spent_amount: u64,
    pub reserved: [u8; 32],
}

impl AccountSize for ProviderPolicy {
    const LEN: usize = 132;
    const DISCRIMINATOR: [u8; 8] = *b"MMPPV001";
}
