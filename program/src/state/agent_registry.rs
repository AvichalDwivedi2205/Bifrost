use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

use crate::state::AccountSize;

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum AgentStatus {
    Active,
    Inactive,
    Suspended,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct AgentRegistry {
    pub discriminator: [u8; 8],
    pub version: u8,
    pub status: AgentStatus,
    pub bump: u8,
    pub reserved0: u8,
    pub agent: Pubkey,
    pub payout_wallet: Pubkey,
    pub verifier: Pubkey,
    pub capability_hash: [u8; 32],
    pub metadata_hash: [u8; 32],
    pub privacy_policy_hash: [u8; 32],
    pub reserved: [u8; 32],
}

impl AccountSize for AgentRegistry {
    const LEN: usize = 236;
    const DISCRIMINATOR: [u8; 8] = *b"MMAGT001";
}
