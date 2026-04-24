use solana_program::{log::sol_log_data, pubkey::Pubkey};

pub fn emit_mission_created(mission_id: Pubkey, authority: Pubkey, budget: u64, ts: i64) {
    sol_log_data(&[
        b"MISSION_CREATED",
        mission_id.as_ref(),
        authority.as_ref(),
        &budget.to_le_bytes(),
        &ts.to_le_bytes(),
    ]);
}

pub fn emit_mission_funded(mission_id: Pubkey, amount: u64) {
    sol_log_data(&[
        b"MISSION_FUNDED",
        mission_id.as_ref(),
        &amount.to_le_bytes(),
    ]);
}

pub fn emit_allocation_created(mission_id: Pubkey, agent: Pubkey, committed: u64) {
    sol_log_data(&[
        b"ALLOCATION_CREATED",
        mission_id.as_ref(),
        agent.as_ref(),
        &committed.to_le_bytes(),
    ]);
}

pub fn emit_spend_executed(mission_id: Pubkey, agent: Pubkey, service: Pubkey, amount: u64) {
    sol_log_data(&[
        b"SPEND_EXECUTED",
        mission_id.as_ref(),
        agent.as_ref(),
        service.as_ref(),
        &amount.to_le_bytes(),
    ]);
}

pub fn emit_verification_submitted(mission_id: Pubkey, verifier: Pubkey, approved: bool) {
    sol_log_data(&[
        b"VERIFICATION_SUBMITTED",
        mission_id.as_ref(),
        verifier.as_ref(),
        &[approved as u8],
    ]);
}

pub fn emit_allocation_settled(mission_id: Pubkey, agent: Pubkey, amount: u64) {
    sol_log_data(&[
        b"ALLOCATION_SETTLED",
        mission_id.as_ref(),
        agent.as_ref(),
        &amount.to_le_bytes(),
    ]);
}

pub fn emit_mission_refunded(mission_id: Pubkey, amount: u64) {
    sol_log_data(&[
        b"MISSION_REFUNDED",
        mission_id.as_ref(),
        &amount.to_le_bytes(),
    ]);
}
