use borsh::BorshDeserialize;
use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, program_error::ProgramError,
    pubkey::Pubkey,
};

use crate::{
    instruction::MissionInstruction,
    instructions::{admin, allocation, mission, spend, verification},
};

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = MissionInstruction::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    match instruction {
        MissionInstruction::InitializeProtocol(args) => {
            admin::initialize_protocol(program_id, accounts, args)
        }
        MissionInstruction::UpdateProtocol(args) => {
            admin::update_protocol(program_id, accounts, args)
        }
        MissionInstruction::RegisterAgent(args) => {
            admin::register_agent(program_id, accounts, args)
        }
        MissionInstruction::UpdateAgent(args) => admin::update_agent(program_id, accounts, args),
        MissionInstruction::CreateMission(args) => {
            mission::create_mission(program_id, accounts, args)
        }
        MissionInstruction::FundMission(args) => mission::fund_mission(program_id, accounts, args),
        MissionInstruction::ActivateMission => mission::activate_mission(program_id, accounts),
        MissionInstruction::PauseMission => mission::pause_mission(program_id, accounts),
        MissionInstruction::CancelMission => mission::cancel_mission(program_id, accounts),
        MissionInstruction::CreateAllocation(args) => {
            allocation::create_allocation(program_id, accounts, args)
        }
        MissionInstruction::UpsertProviderPolicy(args) => {
            allocation::upsert_provider_policy(program_id, accounts, args)
        }
        MissionInstruction::RequestSpend(args) => spend::request_spend(program_id, accounts, args),
        MissionInstruction::ApproveSpend(args) => spend::approve_spend(program_id, accounts, args),
        MissionInstruction::ExecuteSpend(args) => spend::execute_spend(program_id, accounts, args),
        MissionInstruction::SubmitVerification(args) => {
            verification::submit_verification(program_id, accounts, args)
        }
        MissionInstruction::ChallengeVerification(args) => {
            verification::challenge_verification(program_id, accounts, args)
        }
        MissionInstruction::ResolveDispute(args) => {
            verification::resolve_dispute(program_id, accounts, args)
        }
        MissionInstruction::SettleAllocation(args) => {
            allocation::settle_allocation(program_id, accounts, args)
        }
        MissionInstruction::FinalizeAllocation(args) => {
            allocation::finalize_allocation(program_id, accounts, args)
        }
        MissionInstruction::RefundMission(args) => {
            mission::refund_mission(program_id, accounts, args)
        }
    }
}
