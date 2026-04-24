use solana_program::{
    account_info::AccountInfo, clock::Clock, entrypoint::ProgramResult, pubkey::Pubkey,
    sysvar::Sysvar,
};

use crate::{
    error::MissionError,
    instructions::common::reputation_pda,
    state::{read_state, write_state, AccountSize, AgentReputation},
    utils::{checked_add, create_pda_account, require_account_key, require_owner},
};

#[derive(Debug, Clone, Copy, Default)]
pub struct ReputationDelta {
    pub completed: u64,
    pub failed: u64,
    pub earned: u64,
    pub tool_spend: u64,
    pub disputes_won: u64,
    pub disputes_lost: u64,
}

pub fn update_reputation<'a>(
    program_id: &Pubkey,
    reputation_account: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    payer: &AccountInfo<'a>,
    agent: Pubkey,
    delta: ReputationDelta,
) -> ProgramResult {
    let (expected_reputation, bump) = reputation_pda(program_id, &agent);
    require_account_key(
        reputation_account,
        &expected_reputation,
        MissionError::InvalidPda,
    )?;

    let mut reputation = if reputation_account.data_is_empty() {
        create_pda_account(
            payer,
            reputation_account,
            system_program,
            program_id,
            AgentReputation::LEN,
            &[b"reputation", agent.as_ref(), &[bump]],
        )?;
        AgentReputation {
            discriminator: AgentReputation::DISCRIMINATOR,
            version: 1,
            bump,
            reserved0: [0; 2],
            agent,
            missions_completed: 0,
            missions_failed: 0,
            total_earned: 0,
            total_tool_spend: 0,
            disputes_won: 0,
            disputes_lost: 0,
            last_updated: 0,
            reserved: [0; 36],
        }
    } else {
        require_owner(reputation_account, program_id)?;
        read_state(reputation_account)?
    };

    reputation.missions_completed = checked_add(reputation.missions_completed, delta.completed)?;
    reputation.missions_failed = checked_add(reputation.missions_failed, delta.failed)?;
    reputation.total_earned = checked_add(reputation.total_earned, delta.earned)?;
    reputation.total_tool_spend = checked_add(reputation.total_tool_spend, delta.tool_spend)?;
    reputation.disputes_won = checked_add(reputation.disputes_won, delta.disputes_won)?;
    reputation.disputes_lost = checked_add(reputation.disputes_lost, delta.disputes_lost)?;
    reputation.last_updated = Clock::get()?.unix_timestamp;
    write_state(reputation_account, &reputation)
}
