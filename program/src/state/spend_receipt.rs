use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

use crate::state::AccountSize;

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct SpendReceipt {
    pub discriminator: [u8; 8],
    pub version: u8,
    pub bump: u8,
    pub reserved0: [u8; 2],
    pub mission: Pubkey,
    pub allocation: Pubkey,
    pub request: Pubkey,
    pub provider: Pubkey,
    pub agent: Pubkey,
    pub memo_hash: [u8; 32],
    pub tx_ref_hash: [u8; 32],
    pub amount: u64,
    pub executed_at: i64,
    pub reserved: [u8; 12],
}

impl AccountSize for SpendReceipt {
    const LEN: usize = 264;
    const DISCRIMINATOR: [u8; 8] = *b"MMRCP001";
}
