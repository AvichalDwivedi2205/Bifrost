use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

use crate::state::AccountSize;

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct ProtocolConfig {
    pub discriminator: [u8; 8],
    pub version: u8,
    pub bump: u8,
    pub mission_creation_paused: bool,
    pub agent_registration_paused: bool,
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub allowed_mint: Pubkey,
    pub protocol_fee_bps: u16,
    pub reserved: [u8; 51],
}

impl AccountSize for ProtocolConfig {
    const LEN: usize = 168;
    const DISCRIMINATOR: [u8; 8] = *b"MMCFG001";
}
