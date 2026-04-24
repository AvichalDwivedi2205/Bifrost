use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

use crate::state::AccountSize;

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct AgentReputation {
    pub discriminator: [u8; 8],
    pub version: u8,
    pub bump: u8,
    pub reserved0: [u8; 2],
    pub agent: Pubkey,
    pub missions_completed: u64,
    pub missions_failed: u64,
    pub total_earned: u64,
    pub total_tool_spend: u64,
    pub disputes_won: u64,
    pub disputes_lost: u64,
    pub last_updated: i64,
    pub reserved: [u8; 36],
}

impl AccountSize for AgentReputation {
    const LEN: usize = 136;
    const DISCRIMINATOR: [u8; 8] = *b"MMREP001";
}
