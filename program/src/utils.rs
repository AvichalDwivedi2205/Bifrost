use solana_program::{
    account_info::AccountInfo,
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
    program_error::ProgramError,
    program_pack::Pack,
    pubkey,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction, system_program,
    sysvar::Sysvar,
};
use spl_token::state::{Account as TokenAccount, Mint};

use crate::error::MissionError;

pub const ASSOCIATED_TOKEN_PROGRAM_ID: Pubkey =
    pubkey!("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

#[derive(borsh::BorshSerialize)]
enum AssociatedTokenAccountInstruction {
    Create,
}

pub fn require_signer(account: &AccountInfo) -> Result<(), ProgramError> {
    if !account.is_signer {
        return Err(MissionError::MissingSigner.into());
    }

    Ok(())
}

pub fn require_owner(account: &AccountInfo, owner: &Pubkey) -> Result<(), ProgramError> {
    if account.owner != owner {
        return Err(MissionError::InvalidAccountOwner.into());
    }

    Ok(())
}

pub fn checked_add(left: u64, right: u64) -> Result<u64, ProgramError> {
    left.checked_add(right)
        .ok_or_else(|| MissionError::ArithmeticOverflow.into())
}

pub fn checked_sub(left: u64, right: u64) -> Result<u64, ProgramError> {
    left.checked_sub(right)
        .ok_or_else(|| MissionError::ArithmeticOverflow.into())
}

pub fn require_account_key(
    account: &AccountInfo,
    expected: &Pubkey,
    error: MissionError,
) -> Result<(), ProgramError> {
    if account.key != expected {
        return Err(error.into());
    }

    Ok(())
}

pub fn require_system_program(account: &AccountInfo) -> Result<(), ProgramError> {
    require_account_key(
        account,
        &system_program::id(),
        MissionError::InvalidSystemProgram,
    )
}

pub fn require_token_program(account: &AccountInfo) -> Result<(), ProgramError> {
    require_account_key(account, &spl_token::id(), MissionError::InvalidTokenProgram)
}

pub fn require_associated_token_program(account: &AccountInfo) -> Result<(), ProgramError> {
    require_account_key(
        account,
        &ASSOCIATED_TOKEN_PROGRAM_ID,
        MissionError::InvalidAssociatedTokenProgram,
    )
}

pub fn get_associated_token_address_with_program_id(
    wallet_address: &Pubkey,
    token_mint_address: &Pubkey,
    token_program_id: &Pubkey,
) -> Pubkey {
    Pubkey::find_program_address(
        &[
            wallet_address.as_ref(),
            token_program_id.as_ref(),
            token_mint_address.as_ref(),
        ],
        &ASSOCIATED_TOKEN_PROGRAM_ID,
    )
    .0
}

pub fn create_associated_token_account_instruction(
    funding_address: &Pubkey,
    wallet_address: &Pubkey,
    token_mint_address: &Pubkey,
    token_program_id: &Pubkey,
) -> Result<Instruction, ProgramError> {
    let associated_account_address = get_associated_token_address_with_program_id(
        wallet_address,
        token_mint_address,
        token_program_id,
    );
    let data = borsh::to_vec(&AssociatedTokenAccountInstruction::Create)?;

    Ok(Instruction {
        program_id: ASSOCIATED_TOKEN_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(*funding_address, true),
            AccountMeta::new(associated_account_address, false),
            AccountMeta::new_readonly(*wallet_address, false),
            AccountMeta::new_readonly(*token_mint_address, false),
            AccountMeta::new_readonly(system_program::id(), false),
            AccountMeta::new_readonly(*token_program_id, false),
        ],
        data,
    })
}

pub fn create_pda_account<'a>(
    payer: &AccountInfo<'a>,
    new_account: &AccountInfo<'a>,
    system_program_account: &AccountInfo<'a>,
    owner: &Pubkey,
    space: usize,
    signer_seeds: &[&[u8]],
) -> Result<(), ProgramError> {
    require_signer(payer)?;
    require_system_program(system_program_account)?;

    if !new_account.data_is_empty() || **new_account.lamports.borrow() != 0 {
        return Err(MissionError::AccountAlreadyInitialized.into());
    }

    let rent = Rent::get()?;
    let lamports = rent.minimum_balance(space);
    let instruction = system_instruction::create_account(
        payer.key,
        new_account.key,
        lamports,
        space as u64,
        owner,
    );

    invoke_signed(
        &instruction,
        &[
            payer.clone(),
            new_account.clone(),
            system_program_account.clone(),
        ],
        &[signer_seeds],
    )?;

    Ok(())
}

pub fn read_mint(account: &AccountInfo) -> Result<Mint, ProgramError> {
    Mint::unpack(&account.try_borrow_data()?).map_err(|_| MissionError::InvalidMint.into())
}

pub fn read_token_account(account: &AccountInfo) -> Result<TokenAccount, ProgramError> {
    TokenAccount::unpack(&account.try_borrow_data()?)
        .map_err(|_| MissionError::InvalidTokenAccount.into())
}

pub fn _require_rent_exempt<T: Pack>(
    _account: &AccountInfo,
    _minimum_balance: usize,
) -> Result<(), ProgramError> {
    Ok(())
}
