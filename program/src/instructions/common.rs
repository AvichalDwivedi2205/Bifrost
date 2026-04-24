use solana_program::{account_info::AccountInfo, program_error::ProgramError, pubkey::Pubkey};

use crate::{
    error::MissionError,
    utils::{get_associated_token_address_with_program_id, read_token_account},
};

pub fn verify_token_account(
    token_account: &AccountInfo,
    mint: &Pubkey,
    owner: &Pubkey,
) -> Result<(), ProgramError> {
    let token_state = read_token_account(token_account)?;
    if token_state.mint != *mint {
        return Err(MissionError::InvalidMint.into());
    }
    if token_state.owner != *owner {
        return Err(MissionError::InvalidTokenOwner.into());
    }

    Ok(())
}

pub fn protocol_config_pda(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"config"], program_id)
}

pub fn agent_registry_pda(program_id: &Pubkey, agent: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"agent-registry", agent.as_ref()], program_id)
}

pub fn mission_pda(program_id: &Pubkey, creator: &Pubkey, mission_ref: &[u8; 32]) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"mission", creator.as_ref(), mission_ref], program_id)
}

pub fn vault_authority_pda(program_id: &Pubkey, mission: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"vault-authority", mission.as_ref()], program_id)
}

pub fn allocation_pda(
    program_id: &Pubkey,
    mission: &Pubkey,
    agent: &Pubkey,
    allocation_ref: &[u8; 32],
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            b"allocation",
            mission.as_ref(),
            agent.as_ref(),
            allocation_ref,
        ],
        program_id,
    )
}

pub fn provider_policy_pda(
    program_id: &Pubkey,
    allocation: &Pubkey,
    provider: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"provider-policy", allocation.as_ref(), provider.as_ref()],
        program_id,
    )
}

pub fn spend_request_pda(
    program_id: &Pubkey,
    allocation: &Pubkey,
    request_ref: &[u8; 32],
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"spend-request", allocation.as_ref(), request_ref],
        program_id,
    )
}

pub fn receipt_pda(program_id: &Pubkey, request: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"receipt", request.as_ref()], program_id)
}

pub fn verification_pda(program_id: &Pubkey, mission: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"verification", mission.as_ref()], program_id)
}

pub fn dispute_pda(program_id: &Pubkey, verification: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"dispute", verification.as_ref()], program_id)
}

pub fn reputation_pda(program_id: &Pubkey, agent: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"reputation", agent.as_ref()], program_id)
}

pub fn expected_vault_authority(
    program_id: &Pubkey,
    mission: &Pubkey,
) -> Result<Pubkey, ProgramError> {
    Ok(vault_authority_pda(program_id, mission).0)
}

pub fn expected_vault_ata(
    program_id: &Pubkey,
    mission: &Pubkey,
    mint: &Pubkey,
) -> Result<Pubkey, ProgramError> {
    let vault_authority = expected_vault_authority(program_id, mission)?;
    Ok(get_associated_token_address_with_program_id(
        &vault_authority,
        mint,
        &spl_token::id(),
    ))
}
