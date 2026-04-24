use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
    entrypoint::ProgramResult,
    program::invoke_signed,
    pubkey::Pubkey,
    sysvar::Sysvar,
};
use spl_token::instruction::transfer_checked;

use crate::{
    error::MissionError,
    event::emit_spend_executed,
    instruction::{ApproveSpendArgs, ExecuteSpendArgs, RequestSpendArgs},
    instructions::common::{
        expected_vault_ata, expected_vault_authority, receipt_pda, spend_request_pda,
        verify_token_account,
    },
    state::{
        read_state, write_state, AccountSize, Allocation, AllocationStatus, Mission, MissionStatus,
        ProviderPolicy, ProviderStatus, SpendReceipt, SpendRequest, SpendStatus,
    },
    utils::{
        checked_add, checked_sub, create_pda_account, read_mint, require_account_key,
        require_owner, require_signer, require_system_program, require_token_program,
    },
};

pub fn request_spend(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: RequestSpendArgs,
) -> ProgramResult {
    if args.amount == 0 || args.ttl_seconds <= 0 {
        return Err(MissionError::AmountMustBePositive.into());
    }

    let accounts_iter = &mut accounts.iter();
    let agent = next_account_info(accounts_iter)?;
    let mission_account = next_account_info(accounts_iter)?;
    let allocation_account = next_account_info(accounts_iter)?;
    let provider_policy_account = next_account_info(accounts_iter)?;
    let request_account = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;

    require_signer(agent)?;
    require_owner(mission_account, program_id)?;
    require_owner(allocation_account, program_id)?;
    require_owner(provider_policy_account, program_id)?;
    require_system_program(system_program)?;

    let mission: Mission = read_state(mission_account)?;
    let allocation: Allocation = read_state(allocation_account)?;
    let policy: ProviderPolicy = read_state(provider_policy_account)?;

    if mission.status != MissionStatus::Active {
        return Err(MissionError::MissionNotActive.into());
    }
    if allocation.status != AllocationStatus::Active {
        return Err(MissionError::AllocationNotActive.into());
    }
    if allocation.mission != *mission_account.key || allocation.agent != *agent.key {
        return Err(MissionError::InvalidAuthority.into());
    }
    if policy.allocation != *allocation_account.key || policy.status != ProviderStatus::Active {
        return Err(MissionError::ProviderNotApproved.into());
    }
    if args.amount > allocation.max_per_call
        || checked_add(allocation.spend_amount, args.amount)? > allocation.spend_budget_cap
        || args.amount > policy.per_call_cap
        || checked_add(policy.spent_amount, args.amount)? > policy.total_cap
    {
        return Err(MissionError::BudgetExceeded.into());
    }

    let (expected_request, request_bump) =
        spend_request_pda(program_id, allocation_account.key, &args.request_ref);
    require_account_key(request_account, &expected_request, MissionError::InvalidPda)?;

    create_pda_account(
        agent,
        request_account,
        system_program,
        program_id,
        SpendRequest::LEN,
        &[
            b"spend-request",
            allocation_account.key.as_ref(),
            &args.request_ref,
            &[request_bump],
        ],
    )?;

    let now = Clock::get()?.unix_timestamp;
    let request = SpendRequest {
        discriminator: SpendRequest::DISCRIMINATOR,
        version: 1,
        status: if args.amount > allocation.human_approval_above {
            SpendStatus::Pending
        } else {
            SpendStatus::Approved
        },
        bump: request_bump,
        reserved0: 0,
        mission: *mission_account.key,
        allocation: *allocation_account.key,
        agent: *agent.key,
        provider: policy.provider,
        request_ref: args.request_ref,
        purpose_hash: args.purpose_hash,
        amount: args.amount,
        requested_at: now,
        approved_at: if args.amount > allocation.human_approval_above {
            0
        } else {
            now
        },
        expires_at: now
            .checked_add(args.ttl_seconds)
            .ok_or(MissionError::ArithmeticOverflow)?,
        reserved: [0; 32],
    };

    write_state(request_account, &request)
}

pub fn approve_spend(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: ApproveSpendArgs,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let creator = next_account_info(accounts_iter)?;
    let mission_account = next_account_info(accounts_iter)?;
    let allocation_account = next_account_info(accounts_iter)?;
    let request_account = next_account_info(accounts_iter)?;

    require_signer(creator)?;
    require_owner(mission_account, program_id)?;
    require_owner(allocation_account, program_id)?;
    require_owner(request_account, program_id)?;

    let mission: Mission = read_state(mission_account)?;
    let allocation: Allocation = read_state(allocation_account)?;
    let mut request: SpendRequest = read_state(request_account)?;

    if mission.creator != *creator.key {
        return Err(MissionError::InvalidAuthority.into());
    }
    if allocation.mission != *mission_account.key || request.allocation != *allocation_account.key {
        return Err(MissionError::InvalidAccountData.into());
    }
    if request.status != SpendStatus::Pending {
        return Err(MissionError::SpendNotPending.into());
    }

    request.status = if args.approve {
        SpendStatus::Approved
    } else {
        SpendStatus::Rejected
    };
    request.approved_at = Clock::get()?.unix_timestamp;
    write_state(request_account, &request)
}

pub fn execute_spend(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: ExecuteSpendArgs,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let actor = next_account_info(accounts_iter)?;
    let mission_account = next_account_info(accounts_iter)?;
    let allocation_account = next_account_info(accounts_iter)?;
    let provider_policy_account = next_account_info(accounts_iter)?;
    let request_account = next_account_info(accounts_iter)?;
    let receipt_account = next_account_info(accounts_iter)?;
    let mission_vault_ata = next_account_info(accounts_iter)?;
    let vault_authority = next_account_info(accounts_iter)?;
    let provider_token_account = next_account_info(accounts_iter)?;
    let provider_wallet = next_account_info(accounts_iter)?;
    let mint = next_account_info(accounts_iter)?;
    let token_program = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;

    require_signer(actor)?;
    require_owner(mission_account, program_id)?;
    require_owner(allocation_account, program_id)?;
    require_owner(provider_policy_account, program_id)?;
    require_owner(request_account, program_id)?;
    require_token_program(token_program)?;
    require_system_program(system_program)?;

    let mut mission: Mission = read_state(mission_account)?;
    let mut allocation: Allocation = read_state(allocation_account)?;
    let mut policy: ProviderPolicy = read_state(provider_policy_account)?;
    let mut request: SpendRequest = read_state(request_account)?;

    if mission.status != MissionStatus::Active {
        return Err(MissionError::MissionNotActive.into());
    }
    if allocation.status != AllocationStatus::Active {
        return Err(MissionError::AllocationNotActive.into());
    }
    if *actor.key != allocation.agent && *actor.key != mission.creator {
        return Err(MissionError::InvalidAuthority.into());
    }
    if request.status != SpendStatus::Approved {
        return Err(MissionError::SpendNotApproved.into());
    }
    if request.expires_at < Clock::get()?.unix_timestamp {
        return Err(MissionError::SpendExpired.into());
    }
    if request.allocation != *allocation_account.key
        || request.mission != *mission_account.key
        || policy.allocation != *allocation_account.key
        || policy.provider != *provider_wallet.key
        || request.provider != *provider_wallet.key
    {
        return Err(MissionError::InvalidAccountData.into());
    }
    if policy.status != ProviderStatus::Active {
        return Err(MissionError::ProviderNotApproved.into());
    }
    if mission.mint != *mint.key {
        return Err(MissionError::InvalidMint.into());
    }

    verify_token_account(provider_token_account, mint.key, provider_wallet.key)?;
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
    verify_token_account(mission_vault_ata, mint.key, vault_authority.key)?;

    let next_spend = checked_add(allocation.spend_amount, request.amount)?;
    if next_spend > allocation.spend_budget_cap {
        return Err(MissionError::AllocationExceeded.into());
    }
    let next_provider_spend = checked_add(policy.spent_amount, request.amount)?;
    if next_provider_spend > policy.total_cap {
        return Err(MissionError::BudgetExceeded.into());
    }

    let (expected_receipt, receipt_bump) = receipt_pda(program_id, request_account.key);
    require_account_key(receipt_account, &expected_receipt, MissionError::InvalidPda)?;
    create_pda_account(
        actor,
        receipt_account,
        system_program,
        program_id,
        SpendReceipt::LEN,
        &[b"receipt", request_account.key.as_ref(), &[receipt_bump]],
    )?;

    let mint_state = read_mint(mint)?;
    invoke_signed(
        &transfer_checked(
            token_program.key,
            mission_vault_ata.key,
            mint.key,
            provider_token_account.key,
            vault_authority.key,
            &[],
            request.amount,
            mint_state.decimals,
        )?,
        &[
            mission_vault_ata.clone(),
            mint.clone(),
            provider_token_account.clone(),
            vault_authority.clone(),
            token_program.clone(),
        ],
        &[&[
            b"vault-authority",
            mission_account.key.as_ref(),
            &[mission.vault_authority_bump],
        ]],
    )?;

    let now = Clock::get()?.unix_timestamp;
    let receipt = SpendReceipt {
        discriminator: SpendReceipt::DISCRIMINATOR,
        version: 1,
        bump: receipt_bump,
        reserved0: [0; 2],
        mission: *mission_account.key,
        allocation: *allocation_account.key,
        request: *request_account.key,
        provider: *provider_wallet.key,
        agent: allocation.agent,
        memo_hash: args.memo_hash,
        tx_ref_hash: args.tx_ref_hash,
        amount: request.amount,
        executed_at: now,
        reserved: [0; 12],
    };

    mission.spent_amount = checked_add(mission.spent_amount, request.amount)?;
    mission.allocated_amount = checked_sub(mission.allocated_amount, request.amount)?;
    allocation.spend_amount = next_spend;
    policy.spent_amount = next_provider_spend;
    request.status = SpendStatus::Executed;
    write_state(receipt_account, &receipt)?;
    write_state(mission_account, &mission)?;
    write_state(allocation_account, &allocation)?;
    write_state(provider_policy_account, &policy)?;
    write_state(request_account, &request)?;
    emit_spend_executed(
        *mission_account.key,
        allocation.agent,
        *provider_wallet.key,
        request.amount,
    );
    Ok(())
}
