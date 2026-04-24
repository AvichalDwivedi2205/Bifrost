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
    event::{emit_allocation_created, emit_allocation_settled},
    instruction::{
        CreateAllocationArgs, FinalizeAllocationArgs, SettleAllocationArgs,
        UpsertProviderPolicyArgs,
    },
    instructions::{
        admin::load_protocol_config,
        common::{
            agent_registry_pda, allocation_pda, expected_vault_ata, expected_vault_authority,
            provider_policy_pda, verification_pda, verify_token_account,
        },
        reputation::{update_reputation, ReputationDelta},
    },
    state::{
        read_state, write_state, AccountSize, AgentRegistry, AgentStatus, Allocation,
        AllocationStatus, Mission, MissionStatus, ProtocolConfig, ProviderPolicy, ProviderStatus,
        VerificationRecord, VerificationStatus,
    },
    utils::{
        checked_add, checked_sub, create_pda_account, read_mint, require_account_key,
        require_owner, require_signer, require_system_program, require_token_program,
    },
};

pub fn create_allocation(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: CreateAllocationArgs,
) -> ProgramResult {
    let committed = checked_add(args.spend_budget_cap, args.payout_cap)?;
    if committed == 0 {
        return Err(MissionError::AmountMustBePositive.into());
    }
    if args.spend_budget_cap == 0 {
        if args.max_per_call != 0 {
            return Err(MissionError::BudgetExceeded.into());
        }
    } else if args.max_per_call == 0 || args.max_per_call > args.spend_budget_cap {
        return Err(MissionError::BudgetExceeded.into());
    }

    let accounts_iter = &mut accounts.iter();
    let creator = next_account_info(accounts_iter)?;
    let mission_account = next_account_info(accounts_iter)?;
    let allocation_account = next_account_info(accounts_iter)?;
    let agent_registry_account = next_account_info(accounts_iter)?;
    let agent = next_account_info(accounts_iter)?;
    let payout_wallet = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;

    require_signer(creator)?;
    require_owner(mission_account, program_id)?;
    require_owner(agent_registry_account, program_id)?;
    require_system_program(system_program)?;

    let mut mission: Mission = read_state(mission_account)?;
    let registry = read_active_registry(
        program_id,
        agent_registry_account,
        agent.key,
        payout_wallet.key,
    )?;
    if mission.creator != *creator.key {
        return Err(MissionError::InvalidAuthority.into());
    }
    if mission.status != MissionStatus::Active {
        return Err(MissionError::MissionNotActive.into());
    }

    let next_allocated = checked_add(mission.allocated_amount, committed)?;
    if next_allocated > mission.total_budget {
        return Err(MissionError::BudgetExceeded.into());
    }

    let (expected_allocation, allocation_bump) = allocation_pda(
        program_id,
        mission_account.key,
        agent.key,
        &args.allocation_ref,
    );
    require_account_key(
        allocation_account,
        &expected_allocation,
        MissionError::InvalidPda,
    )?;

    create_pda_account(
        creator,
        allocation_account,
        system_program,
        program_id,
        Allocation::LEN,
        &[
            b"allocation",
            mission_account.key.as_ref(),
            agent.key.as_ref(),
            &args.allocation_ref,
            &[allocation_bump],
        ],
    )?;

    let allocation = Allocation {
        discriminator: Allocation::DISCRIMINATOR,
        version: 1,
        status: AllocationStatus::Active,
        bump: allocation_bump,
        reserved0: 0,
        mission: *mission_account.key,
        agent: registry.agent,
        payout_wallet: registry.payout_wallet,
        allocation_ref: args.allocation_ref,
        spend_budget_cap: args.spend_budget_cap,
        spend_amount: 0,
        payout_cap: args.payout_cap,
        payout_amount: 0,
        max_per_call: args.max_per_call,
        human_approval_above: args.human_approval_above,
        provider_count: 0,
        policy_commitment_hash: args.policy_commitment_hash,
    };

    mission.allocated_amount = next_allocated;
    mission.allocation_count = mission
        .allocation_count
        .checked_add(1)
        .ok_or(MissionError::ArithmeticOverflow)?;

    write_state(allocation_account, &allocation)?;
    write_state(mission_account, &mission)?;
    emit_allocation_created(*mission_account.key, *agent.key, committed);
    Ok(())
}

pub fn upsert_provider_policy(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: UpsertProviderPolicyArgs,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let creator = next_account_info(accounts_iter)?;
    let mission_account = next_account_info(accounts_iter)?;
    let allocation_account = next_account_info(accounts_iter)?;
    let provider_policy_account = next_account_info(accounts_iter)?;
    let provider_wallet = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;

    require_signer(creator)?;
    require_owner(mission_account, program_id)?;
    require_owner(allocation_account, program_id)?;
    require_system_program(system_program)?;

    let mission: Mission = read_state(mission_account)?;
    let mut allocation: Allocation = read_state(allocation_account)?;

    if mission.creator != *creator.key {
        return Err(MissionError::InvalidAuthority.into());
    }
    if allocation.mission != *mission_account.key {
        return Err(MissionError::InvalidAccountData.into());
    }
    if args.per_call_cap == 0
        || args.per_call_cap > args.total_cap
        || args.total_cap > allocation.spend_budget_cap
    {
        return Err(MissionError::BudgetExceeded.into());
    }

    let (expected_policy, bump) =
        provider_policy_pda(program_id, allocation_account.key, provider_wallet.key);
    require_account_key(
        provider_policy_account,
        &expected_policy,
        MissionError::InvalidPda,
    )?;

    let policy = if provider_policy_account.data_is_empty() {
        create_pda_account(
            creator,
            provider_policy_account,
            system_program,
            program_id,
            ProviderPolicy::LEN,
            &[
                b"provider-policy",
                allocation_account.key.as_ref(),
                provider_wallet.key.as_ref(),
                &[bump],
            ],
        )?;
        allocation.provider_count = allocation
            .provider_count
            .checked_add(1)
            .ok_or(MissionError::ArithmeticOverflow)?;
        ProviderPolicy {
            discriminator: ProviderPolicy::DISCRIMINATOR,
            version: 1,
            status: if args.active {
                ProviderStatus::Active
            } else {
                ProviderStatus::Disabled
            },
            bump,
            reserved0: 0,
            allocation: *allocation_account.key,
            provider: *provider_wallet.key,
            per_call_cap: args.per_call_cap,
            total_cap: args.total_cap,
            spent_amount: 0,
            reserved: [0; 32],
        }
    } else {
        require_owner(provider_policy_account, program_id)?;
        let mut policy: ProviderPolicy = read_state(provider_policy_account)?;
        if policy.allocation != *allocation_account.key || policy.provider != *provider_wallet.key {
            return Err(MissionError::InvalidAccountData.into());
        }
        policy.status = if args.active {
            ProviderStatus::Active
        } else {
            ProviderStatus::Disabled
        };
        policy.per_call_cap = args.per_call_cap;
        policy.total_cap = args.total_cap;
        policy
    };

    write_state(provider_policy_account, &policy)?;
    write_state(allocation_account, &allocation)
}

pub fn settle_allocation(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: SettleAllocationArgs,
) -> ProgramResult {
    if args.amount == 0 {
        return Err(MissionError::AmountMustBePositive.into());
    }

    let accounts_iter = &mut accounts.iter();
    let creator = next_account_info(accounts_iter)?;
    let config_account = next_account_info(accounts_iter)?;
    let mission_account = next_account_info(accounts_iter)?;
    let allocation_account = next_account_info(accounts_iter)?;
    let verification_account = next_account_info(accounts_iter)?;
    let mission_vault_ata = next_account_info(accounts_iter)?;
    let vault_authority = next_account_info(accounts_iter)?;
    let payout_token_account = next_account_info(accounts_iter)?;
    let treasury_token_account = next_account_info(accounts_iter)?;
    let mint = next_account_info(accounts_iter)?;
    let token_program = next_account_info(accounts_iter)?;

    require_signer(creator)?;
    require_owner(mission_account, program_id)?;
    require_owner(allocation_account, program_id)?;
    require_owner(verification_account, program_id)?;
    require_token_program(token_program)?;

    let config = load_protocol_config(program_id, config_account)?;
    let mut mission: Mission = read_state(mission_account)?;
    let mut allocation: Allocation = read_state(allocation_account)?;
    let verification: VerificationRecord = read_state(verification_account)?;

    if mission.creator != *creator.key {
        return Err(MissionError::InvalidAuthority.into());
    }
    if allocation.mission != *mission_account.key || allocation.status != AllocationStatus::Active {
        return Err(MissionError::AllocationNotActive.into());
    }
    if verification.mission != *mission_account.key {
        return Err(MissionError::InvalidAccountData.into());
    }
    let (expected_verification, _) = verification_pda(program_id, mission_account.key);
    require_account_key(
        verification_account,
        &expected_verification,
        MissionError::InvalidPda,
    )?;
    if verification.status != VerificationStatus::Approved {
        return Err(MissionError::VerificationChallenged.into());
    }
    if Clock::get()?.unix_timestamp <= verification.challenge_window_end {
        return Err(MissionError::ChallengeWindowStillOpen.into());
    }

    let next_payout = checked_add(allocation.payout_amount, args.amount)?;
    if next_payout > allocation.payout_cap {
        return Err(MissionError::AllocationExceeded.into());
    }

    let expected_vault_authority = expected_vault_authority(program_id, mission_account.key)?;
    if mission.mint != *mint.key {
        return Err(MissionError::InvalidMint.into());
    }
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
    verify_token_account(payout_token_account, mint.key, &allocation.payout_wallet)?;
    verify_token_account(treasury_token_account, mint.key, &config.treasury)?;

    let fee_amount = compute_protocol_fee(args.amount, &config)?;
    let payout_amount = checked_sub(args.amount, fee_amount)?;

    let mint_state = read_mint(mint)?;
    if fee_amount > 0 {
        invoke_signed(
            &transfer_checked(
                token_program.key,
                mission_vault_ata.key,
                mint.key,
                treasury_token_account.key,
                vault_authority.key,
                &[],
                fee_amount,
                mint_state.decimals,
            )?,
            &[
                mission_vault_ata.clone(),
                mint.clone(),
                treasury_token_account.clone(),
                vault_authority.clone(),
                token_program.clone(),
            ],
            &[&[
                b"vault-authority",
                mission_account.key.as_ref(),
                &[mission.vault_authority_bump],
            ]],
        )?;
    }

    if payout_amount > 0 {
        invoke_signed(
            &transfer_checked(
                token_program.key,
                mission_vault_ata.key,
                mint.key,
                payout_token_account.key,
                vault_authority.key,
                &[],
                payout_amount,
                mint_state.decimals,
            )?,
            &[
                mission_vault_ata.clone(),
                mint.clone(),
                payout_token_account.clone(),
                vault_authority.clone(),
                token_program.clone(),
            ],
            &[&[
                b"vault-authority",
                mission_account.key.as_ref(),
                &[mission.vault_authority_bump],
            ]],
        )?;
    }

    allocation.payout_amount = next_payout;
    mission.settled_amount = checked_add(mission.settled_amount, args.amount)?;
    mission.allocated_amount = checked_sub(mission.allocated_amount, args.amount)?;

    write_state(mission_account, &mission)?;
    write_state(allocation_account, &allocation)?;
    emit_allocation_settled(*mission_account.key, allocation.agent, args.amount);
    Ok(())
}

pub fn finalize_allocation(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: FinalizeAllocationArgs,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let creator = next_account_info(accounts_iter)?;
    let mission_account = next_account_info(accounts_iter)?;
    let allocation_account = next_account_info(accounts_iter)?;
    let reputation_account = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    let verification_account = accounts_iter.next();

    require_signer(creator)?;
    require_owner(mission_account, program_id)?;
    require_owner(allocation_account, program_id)?;
    require_system_program(system_program)?;

    let mut mission: Mission = read_state(mission_account)?;
    let mut allocation: Allocation = read_state(allocation_account)?;

    if mission.creator != *creator.key {
        return Err(MissionError::InvalidAuthority.into());
    }
    if allocation.mission != *mission_account.key {
        return Err(MissionError::InvalidAccountData.into());
    }
    if matches!(
        allocation.status,
        AllocationStatus::Settled | AllocationStatus::Cancelled
    ) {
        return Err(MissionError::AllocationAlreadyFinalized.into());
    }
    if allocation.status != AllocationStatus::Active {
        return Err(MissionError::AllocationNotActive.into());
    }

    let verification =
        load_finalizable_verification(program_id, mission_account.key, verification_account)?;
    let verification_approved = matches!(
        verification.as_ref().map(|record| record.status),
        Some(VerificationStatus::Approved)
    );
    let verification_rejected = matches!(
        verification.as_ref().map(|record| record.status),
        Some(VerificationStatus::Rejected)
    );
    if args.successful && !verification_approved {
        return Err(MissionError::VerificationNotApproved.into());
    }
    if !args.successful && !verification_rejected {
        return Err(MissionError::VerificationRejected.into());
    }

    let remaining_spend = checked_sub(allocation.spend_budget_cap, allocation.spend_amount)?;
    let remaining_payout = checked_sub(allocation.payout_cap, allocation.payout_amount)?;
    let remaining_reserved = checked_add(remaining_spend, remaining_payout)?;
    mission.allocated_amount = checked_sub(mission.allocated_amount, remaining_reserved)?;
    allocation.status = if args.successful {
        AllocationStatus::Settled
    } else {
        AllocationStatus::Cancelled
    };

    let mut delta = ReputationDelta {
        completed: if args.successful { 1 } else { 0 },
        failed: if args.successful { 0 } else { 1 },
        earned: allocation.payout_amount,
        tool_spend: allocation.spend_amount,
        disputes_won: 0,
        disputes_lost: 0,
    };
    if let Some(verification) = verification.as_ref() {
        if verification.challenged_by != Pubkey::default() {
            match verification.status {
                VerificationStatus::Approved => delta.disputes_won = 1,
                VerificationStatus::Rejected => delta.disputes_lost = 1,
                _ => {}
            }
        }
    }

    update_reputation(
        program_id,
        reputation_account,
        system_program,
        creator,
        allocation.agent,
        delta,
    )?;

    if mission.allocated_amount == 0 {
        mission.status = if verification_approved {
            MissionStatus::Settled
        } else {
            MissionStatus::Cancelled
        };
    }

    write_state(mission_account, &mission)?;
    write_state(allocation_account, &allocation)
}

fn read_active_registry(
    program_id: &Pubkey,
    registry_account: &AccountInfo,
    expected_agent: &Pubkey,
    expected_payout_wallet: &Pubkey,
) -> Result<AgentRegistry, solana_program::program_error::ProgramError> {
    require_owner(registry_account, program_id)?;
    let (expected_registry, _) = agent_registry_pda(program_id, expected_agent);
    require_account_key(
        registry_account,
        &expected_registry,
        MissionError::InvalidAgentRegistry,
    )?;
    let registry: AgentRegistry = read_state(registry_account)?;
    if registry.agent != *expected_agent || registry.payout_wallet != *expected_payout_wallet {
        return Err(MissionError::InvalidAgentRegistry.into());
    }
    if registry.status != AgentStatus::Active {
        return Err(MissionError::AgentNotActive.into());
    }
    Ok(registry)
}

fn load_finalizable_verification(
    program_id: &Pubkey,
    mission: &Pubkey,
    verification_account: Option<&AccountInfo>,
) -> Result<Option<VerificationRecord>, solana_program::program_error::ProgramError> {
    let Some(verification_account) = verification_account else {
        return Ok(None);
    };
    require_owner(verification_account, program_id)?;
    let (expected_verification, _) = verification_pda(program_id, mission);
    require_account_key(
        verification_account,
        &expected_verification,
        MissionError::InvalidPda,
    )?;
    let verification: VerificationRecord = read_state(verification_account)?;
    if verification.mission != *mission {
        return Err(MissionError::InvalidAccountData.into());
    }
    match verification.status {
        VerificationStatus::Approved => {
            if Clock::get()?.unix_timestamp <= verification.challenge_window_end {
                return Err(MissionError::ChallengeWindowStillOpen.into());
            }
            Ok(Some(verification))
        }
        VerificationStatus::Rejected => Ok(Some(verification)),
        VerificationStatus::Pending | VerificationStatus::Challenged => Ok(None),
    }
}

fn compute_protocol_fee(
    amount: u64,
    config: &ProtocolConfig,
) -> Result<u64, solana_program::program_error::ProgramError> {
    if config.protocol_fee_bps > 10_000 {
        return Err(MissionError::FeeTooHigh.into());
    }
    Ok(((amount as u128) * (config.protocol_fee_bps as u128) / 10_000u128) as u64)
}
