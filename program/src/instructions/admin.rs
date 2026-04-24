use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    pubkey::Pubkey,
};

use crate::{
    error::MissionError,
    instruction::{InitializeProtocolArgs, RegisterAgentArgs, UpdateAgentArgs, UpdateProtocolArgs},
    instructions::common::{agent_registry_pda, protocol_config_pda},
    state::{read_state, write_state, AccountSize, AgentRegistry, AgentStatus, ProtocolConfig},
    utils::{
        create_pda_account, require_account_key, require_owner, require_signer,
        require_system_program,
    },
};

pub fn initialize_protocol(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: InitializeProtocolArgs,
) -> ProgramResult {
    if args.protocol_fee_bps > 10_000 {
        return Err(MissionError::FeeTooHigh.into());
    }

    let accounts_iter = &mut accounts.iter();
    let admin = next_account_info(accounts_iter)?;
    let config_account = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;

    require_signer(admin)?;
    require_system_program(system_program)?;

    let (expected_config, bump) = protocol_config_pda(program_id);
    require_account_key(
        config_account,
        &expected_config,
        MissionError::InvalidProtocolConfig,
    )?;

    create_pda_account(
        admin,
        config_account,
        system_program,
        program_id,
        ProtocolConfig::LEN,
        &[b"config", &[bump]],
    )?;

    let config = ProtocolConfig {
        discriminator: ProtocolConfig::DISCRIMINATOR,
        version: 1,
        bump,
        mission_creation_paused: args.mission_creation_paused,
        agent_registration_paused: args.agent_registration_paused,
        admin: *admin.key,
        treasury: args.treasury,
        allowed_mint: args.allowed_mint,
        protocol_fee_bps: args.protocol_fee_bps,
        reserved: [0; 51],
    };

    write_state(config_account, &config)
}

pub fn update_protocol(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: UpdateProtocolArgs,
) -> ProgramResult {
    if args.protocol_fee_bps > 10_000 {
        return Err(MissionError::FeeTooHigh.into());
    }

    let accounts_iter = &mut accounts.iter();
    let admin = next_account_info(accounts_iter)?;
    let config_account = next_account_info(accounts_iter)?;

    require_signer(admin)?;
    require_owner(config_account, program_id)?;

    let (expected_config, _) = protocol_config_pda(program_id);
    require_account_key(
        config_account,
        &expected_config,
        MissionError::InvalidProtocolConfig,
    )?;

    let mut config: ProtocolConfig = read_state(config_account)?;
    if config.admin != *admin.key {
        return Err(MissionError::InvalidAuthority.into());
    }

    config.treasury = args.treasury;
    config.allowed_mint = args.allowed_mint;
    config.protocol_fee_bps = args.protocol_fee_bps;
    config.mission_creation_paused = args.mission_creation_paused;
    config.agent_registration_paused = args.agent_registration_paused;
    write_state(config_account, &config)
}

pub fn register_agent(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: RegisterAgentArgs,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let agent = next_account_info(accounts_iter)?;
    let config_account = next_account_info(accounts_iter)?;
    let registry_account = next_account_info(accounts_iter)?;
    let payout_wallet = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;

    require_signer(agent)?;
    require_owner(config_account, program_id)?;
    require_system_program(system_program)?;

    let config = load_protocol_config(program_id, config_account)?;
    if config.agent_registration_paused {
        return Err(MissionError::AgentRegistrationPaused.into());
    }

    let (expected_registry, bump) = agent_registry_pda(program_id, agent.key);
    require_account_key(
        registry_account,
        &expected_registry,
        MissionError::InvalidAgentRegistry,
    )?;

    create_pda_account(
        agent,
        registry_account,
        system_program,
        program_id,
        AgentRegistry::LEN,
        &[b"agent-registry", agent.key.as_ref(), &[bump]],
    )?;

    let registry = AgentRegistry {
        discriminator: AgentRegistry::DISCRIMINATOR,
        version: 1,
        status: AgentStatus::Active,
        bump,
        reserved0: 0,
        agent: *agent.key,
        payout_wallet: *payout_wallet.key,
        verifier: args.verifier,
        capability_hash: args.capability_hash,
        metadata_hash: args.metadata_hash,
        privacy_policy_hash: args.privacy_policy_hash,
        reserved: [0; 32],
    };

    write_state(registry_account, &registry)
}

pub fn update_agent(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: UpdateAgentArgs,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let authority = next_account_info(accounts_iter)?;
    let config_account = next_account_info(accounts_iter)?;
    let registry_account = next_account_info(accounts_iter)?;
    let agent = next_account_info(accounts_iter)?;
    let payout_wallet = next_account_info(accounts_iter)?;

    require_signer(authority)?;
    require_owner(config_account, program_id)?;
    require_owner(registry_account, program_id)?;

    let config = load_protocol_config(program_id, config_account)?;
    let mut registry: AgentRegistry = read_state(registry_account)?;
    let (expected_registry, _) = agent_registry_pda(program_id, agent.key);
    require_account_key(
        registry_account,
        &expected_registry,
        MissionError::InvalidAgentRegistry,
    )?;

    let authority_is_admin = config.admin == *authority.key;
    let authority_is_agent = registry.agent == *authority.key && registry.agent == *agent.key;
    if !authority_is_admin && !authority_is_agent {
        return Err(MissionError::InvalidAuthority.into());
    }

    registry.payout_wallet = *payout_wallet.key;
    registry.verifier = args.verifier;
    registry.capability_hash = args.capability_hash;
    registry.metadata_hash = args.metadata_hash;
    registry.privacy_policy_hash = args.privacy_policy_hash;
    registry.status = if args.active {
        AgentStatus::Active
    } else {
        AgentStatus::Inactive
    };
    write_state(registry_account, &registry)
}

pub fn load_protocol_config(
    program_id: &Pubkey,
    config_account: &AccountInfo,
) -> Result<ProtocolConfig, solana_program::program_error::ProgramError> {
    require_owner(config_account, program_id)?;
    let (expected_config, _) = protocol_config_pda(program_id);
    require_account_key(
        config_account,
        &expected_config,
        MissionError::InvalidProtocolConfig,
    )?;
    read_state(config_account)
}
