pub mod agent_registry;
pub mod agent_reputation;
pub mod dispute_record;
pub mod mission_vault;
pub mod protocol_config;
pub mod provider_policy;
pub mod spend_policy;
pub mod spend_receipt;
pub mod spend_request;
pub mod verifier_record;

use borsh::{to_vec, BorshDeserialize, BorshSerialize};
use solana_program::{account_info::AccountInfo, program_error::ProgramError};

use crate::error::MissionError;

pub use agent_registry::*;
pub use agent_reputation::*;
pub use dispute_record::*;
pub use mission_vault::*;
pub use protocol_config::*;
pub use provider_policy::*;
pub use spend_policy::*;
pub use spend_receipt::*;
pub use spend_request::*;
pub use verifier_record::*;

pub trait AccountSize {
    const LEN: usize;
    const DISCRIMINATOR: [u8; 8];
}

pub fn read_state<T: BorshDeserialize + AccountSize>(
    account: &AccountInfo,
) -> Result<T, ProgramError> {
    let data = account.try_borrow_data()?;
    if data.len() < T::LEN {
        return Err(MissionError::AccountTooSmall.into());
    }

    if data[..8] != T::DISCRIMINATOR {
        return Err(MissionError::InvalidAccountData.into());
    }

    let mut slice = &data[..T::LEN];
    T::deserialize(&mut slice).map_err(|_| MissionError::InvalidAccountData.into())
}

pub fn write_state<T: BorshSerialize + AccountSize>(
    account: &AccountInfo,
    value: &T,
) -> Result<(), ProgramError> {
    let serialized = to_vec(value).map_err(|_| MissionError::InvalidAccountData)?;

    if serialized.len() > T::LEN || account.data_len() < T::LEN {
        return Err(MissionError::AccountTooSmall.into());
    }
    if serialized.len() < 8 || serialized[..8] != T::DISCRIMINATOR {
        return Err(MissionError::InvalidAccountData.into());
    }

    let mut data = account.try_borrow_mut_data()?;
    data.fill(0);
    data[..serialized.len()].copy_from_slice(&serialized);
    Ok(())
}
