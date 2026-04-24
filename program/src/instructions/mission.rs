use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
    entrypoint::ProgramResult,
    program::{invoke, invoke_signed},
    pubkey::Pubkey,
    sysvar::Sysvar,
};
use spl_token::instruction::transfer_checked;

use crate::{
    error::MissionError,
    event::{emit_mission_created, emit_mission_funded, emit_mission_refunded},
    instruction::{CreateMissionArgs, FundMissionArgs, RefundMissionArgs},
    instructions::admin::load_protocol_config,
    instructions::common::{
        expected_vault_ata, expected_vault_authority, mission_pda, vault_authority_pda,
        verify_token_account,
    },
    state::{read_state, write_state, AccountSize, Mission, MissionStatus},
    utils::{
        checked_add, checked_sub, create_associated_token_account_instruction, create_pda_account,
        get_associated_token_address_with_program_id, read_mint, require_account_key,
        require_associated_token_program, require_owner, require_signer, require_system_program,
        require_token_program,
    },
};

pub fn create_mission(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: CreateMissionArgs,
) -> ProgramResult {
    if args.total_budget == 0 || args.challenge_window_seconds <= 0 {
        return Err(MissionError::AmountMustBePositive.into());
    }

    let accounts_iter = &mut accounts.iter();
    let creator = next_account_info(accounts_iter)?;
    let config_account = next_account_info(accounts_iter)?;
    let mission_account = next_account_info(accounts_iter)?;
    let vault_authority = next_account_info(accounts_iter)?;
    let mission_vault_ata = next_account_info(accounts_iter)?;
    let mint = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    let token_program = next_account_info(accounts_iter)?;
    let associated_token_program = next_account_info(accounts_iter)?;

    require_signer(creator)?;
    require_system_program(system_program)?;
    require_token_program(token_program)?;
    require_associated_token_program(associated_token_program)?;
    read_mint(mint)?;

    let config = load_protocol_config(program_id, config_account)?;
    if config.mission_creation_paused {
        return Err(MissionError::ProtocolPaused.into());
    }
    if config.allowed_mint != *mint.key {
        return Err(MissionError::MintNotAllowed.into());
    }

    let (expected_mission, mission_bump) = mission_pda(program_id, creator.key, &args.mission_ref);
    require_account_key(mission_account, &expected_mission, MissionError::InvalidPda)?;

    let (expected_vault_authority, vault_authority_bump) =
        vault_authority_pda(program_id, mission_account.key);
    require_account_key(
        vault_authority,
        &expected_vault_authority,
        MissionError::InvalidPda,
    )?;

    let expected_vault_ata = get_associated_token_address_with_program_id(
        vault_authority.key,
        mint.key,
        token_program.key,
    );
    require_account_key(
        mission_vault_ata,
        &expected_vault_ata,
        MissionError::InvalidPda,
    )?;

    create_pda_account(
        creator,
        mission_account,
        system_program,
        program_id,
        Mission::LEN,
        &[
            b"mission",
            creator.key.as_ref(),
            &args.mission_ref,
            &[mission_bump],
        ],
    )?;

    invoke(
        &create_associated_token_account_instruction(
            creator.key,
            vault_authority.key,
            mint.key,
            token_program.key,
        )?,
        &[
            creator.clone(),
            mission_vault_ata.clone(),
            vault_authority.clone(),
            mint.clone(),
            system_program.clone(),
            token_program.clone(),
            associated_token_program.clone(),
        ],
    )?;

    let now = Clock::get()?.unix_timestamp;
    let mission = Mission {
        discriminator: Mission::DISCRIMINATOR,
        version: 1,
        status: MissionStatus::Created,
        privacy_mode: args.privacy_mode,
        verification_mode: args.verification_mode,
        mission_bump,
        vault_authority_bump,
        creator: *creator.key,
        mint: *mint.key,
        verifier: args.verifier,
        mission_ref: args.mission_ref,
        metadata_hash: args.metadata_hash,
        private_manifest_hash: args.private_manifest_hash,
        budget_commitment_hash: args.budget_commitment_hash,
        result_hash: [0; 32],
        challenge_window_seconds: args.challenge_window_seconds,
        created_at: now,
        activated_at: 0,
        funded_amount: 0,
        total_budget: args.total_budget,
        allocated_amount: 0,
        spent_amount: 0,
        settled_amount: 0,
        refunded_amount: 0,
        allocation_count: 0,
        reserved: [],
    };

    write_state(mission_account, &mission)?;
    emit_mission_created(*mission_account.key, *creator.key, args.total_budget, now);
    Ok(())
}

pub fn fund_mission(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: FundMissionArgs,
) -> ProgramResult {
    if args.amount == 0 {
        return Err(MissionError::AmountMustBePositive.into());
    }

    let accounts_iter = &mut accounts.iter();
    let creator = next_account_info(accounts_iter)?;
    let mission_account = next_account_info(accounts_iter)?;
    let creator_token_account = next_account_info(accounts_iter)?;
    let mission_vault_ata = next_account_info(accounts_iter)?;
    let mint = next_account_info(accounts_iter)?;
    let token_program = next_account_info(accounts_iter)?;

    require_signer(creator)?;
    require_owner(mission_account, program_id)?;
    require_token_program(token_program)?;

    let mut mission: Mission = read_state(mission_account)?;
    if mission.creator != *creator.key {
        return Err(MissionError::InvalidAuthority.into());
    }
    if mission.mint != *mint.key {
        return Err(MissionError::InvalidMint.into());
    }

    let new_funded = checked_add(mission.funded_amount, args.amount)?;
    if new_funded > mission.total_budget {
        return Err(MissionError::BudgetExceeded.into());
    }

    verify_token_account(creator_token_account, mint.key, creator.key)?;
    let expected_vault_ata = expected_vault_ata(program_id, mission_account.key, mint.key)?;
    require_account_key(
        mission_vault_ata,
        &expected_vault_ata,
        MissionError::InvalidPda,
    )?;
    verify_token_account(
        mission_vault_ata,
        mint.key,
        &expected_vault_authority(program_id, mission_account.key)?,
    )?;

    let mint_state = read_mint(mint)?;
    invoke(
        &transfer_checked(
            token_program.key,
            creator_token_account.key,
            mint.key,
            mission_vault_ata.key,
            creator.key,
            &[],
            args.amount,
            mint_state.decimals,
        )?,
        &[
            creator_token_account.clone(),
            mint.clone(),
            mission_vault_ata.clone(),
            creator.clone(),
            token_program.clone(),
        ],
    )?;

    mission.funded_amount = new_funded;
    write_state(mission_account, &mission)?;
    emit_mission_funded(*mission_account.key, args.amount);
    Ok(())
}

pub fn activate_mission(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let creator = next_account_info(accounts_iter)?;
    let mission_account = next_account_info(accounts_iter)?;

    require_signer(creator)?;
    require_owner(mission_account, program_id)?;

    let mut mission: Mission = read_state(mission_account)?;
    if mission.creator != *creator.key {
        return Err(MissionError::InvalidAuthority.into());
    }
    if mission.funded_amount != mission.total_budget {
        return Err(MissionError::MissionNotFunded.into());
    }
    if !matches!(
        mission.status,
        MissionStatus::Created | MissionStatus::Paused
    ) {
        return Err(MissionError::InvalidStateTransition.into());
    }

    mission.status = MissionStatus::Active;
    mission.activated_at = Clock::get()?.unix_timestamp;
    write_state(mission_account, &mission)
}

pub fn pause_mission(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let creator = next_account_info(accounts_iter)?;
    let mission_account = next_account_info(accounts_iter)?;

    require_signer(creator)?;
    require_owner(mission_account, program_id)?;

    let mut mission: Mission = read_state(mission_account)?;
    if mission.creator != *creator.key {
        return Err(MissionError::InvalidAuthority.into());
    }
    if mission.status != MissionStatus::Active {
        return Err(MissionError::MissionNotActive.into());
    }

    mission.status = MissionStatus::Paused;
    write_state(mission_account, &mission)
}

pub fn cancel_mission(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let creator = next_account_info(accounts_iter)?;
    let mission_account = next_account_info(accounts_iter)?;

    require_signer(creator)?;
    require_owner(mission_account, program_id)?;

    let mut mission: Mission = read_state(mission_account)?;
    if mission.creator != *creator.key {
        return Err(MissionError::InvalidAuthority.into());
    }
    if !matches!(
        mission.status,
        MissionStatus::Created | MissionStatus::Paused | MissionStatus::Active
    ) {
        return Err(MissionError::InvalidStateTransition.into());
    }
    if mission.allocated_amount != 0 {
        return Err(MissionError::AllocationHasOutstandingBudget.into());
    }

    mission.status = MissionStatus::Cancelled;
    write_state(mission_account, &mission)
}

pub fn refund_mission(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: RefundMissionArgs,
) -> ProgramResult {
    if args.amount == 0 {
        return Err(MissionError::AmountMustBePositive.into());
    }

    let accounts_iter = &mut accounts.iter();
    let creator = next_account_info(accounts_iter)?;
    let mission_account = next_account_info(accounts_iter)?;
    let creator_token_account = next_account_info(accounts_iter)?;
    let mission_vault_ata = next_account_info(accounts_iter)?;
    let vault_authority = next_account_info(accounts_iter)?;
    let mint = next_account_info(accounts_iter)?;
    let token_program = next_account_info(accounts_iter)?;

    require_signer(creator)?;
    require_owner(mission_account, program_id)?;
    require_token_program(token_program)?;

    let mut mission: Mission = read_state(mission_account)?;
    if mission.creator != *creator.key {
        return Err(MissionError::InvalidAuthority.into());
    }
    if mission.mint != *mint.key {
        return Err(MissionError::InvalidMint.into());
    }
    if !matches!(
        mission.status,
        MissionStatus::Cancelled | MissionStatus::Settled
    ) {
        return Err(MissionError::RefundNotAllowed.into());
    }
    if mission.allocated_amount != 0 {
        return Err(MissionError::AllocationHasOutstandingBudget.into());
    }

    let expected_vault_authority = expected_vault_authority(program_id, mission_account.key)?;
    require_account_key(
        vault_authority,
        &expected_vault_authority,
        MissionError::InvalidPda,
    )?;
    let expected_vault_ata = expected_vault_ata(program_id, mission_account.key, mint.key)?;
    require_account_key(
        mission_vault_ata,
        &expected_vault_ata,
        MissionError::InvalidPda,
    )?;
    verify_token_account(creator_token_account, mint.key, creator.key)?;
    verify_token_account(mission_vault_ata, mint.key, vault_authority.key)?;

    let remaining_refundable = checked_sub(
        checked_sub(
            checked_sub(mission.funded_amount, mission.spent_amount)?,
            mission.settled_amount,
        )?,
        mission.refunded_amount,
    )?;
    if args.amount > remaining_refundable {
        return Err(MissionError::RefundNotAllowed.into());
    }

    let mint_state = read_mint(mint)?;
    invoke_signed(
        &transfer_checked(
            token_program.key,
            mission_vault_ata.key,
            mint.key,
            creator_token_account.key,
            vault_authority.key,
            &[],
            args.amount,
            mint_state.decimals,
        )?,
        &[
            mission_vault_ata.clone(),
            mint.clone(),
            creator_token_account.clone(),
            vault_authority.clone(),
            token_program.clone(),
        ],
        &[&[
            b"vault-authority",
            mission_account.key.as_ref(),
            &[mission.vault_authority_bump],
        ]],
    )?;

    mission.refunded_amount = checked_add(mission.refunded_amount, args.amount)?;
    write_state(mission_account, &mission)?;
    emit_mission_refunded(*mission_account.key, args.amount);
    Ok(())
}
