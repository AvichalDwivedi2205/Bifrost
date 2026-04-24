use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    sysvar::Sysvar,
};

use crate::{
    error::MissionError,
    event::emit_verification_submitted,
    instruction::{ChallengeVerificationArgs, ResolveDisputeArgs, SubmitVerificationArgs},
    instructions::common::{dispute_pda, verification_pda},
    state::{
        read_state, write_state, AccountSize, DisputeRecord, DisputeStatus, Mission, MissionStatus,
        VerificationRecord, VerificationStatus,
    },
    utils::{
        create_pda_account, require_account_key, require_owner, require_signer,
        require_system_program,
    },
};

pub fn submit_verification(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: SubmitVerificationArgs,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let verifier = next_account_info(accounts_iter)?;
    let mission_account = next_account_info(accounts_iter)?;
    let verification_account = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;

    require_signer(verifier)?;
    require_owner(mission_account, program_id)?;
    require_system_program(system_program)?;

    let mut mission: Mission = read_state(mission_account)?;
    if mission.verifier != *verifier.key {
        return Err(MissionError::InvalidVerifier.into());
    }
    if matches!(
        mission.status,
        MissionStatus::Cancelled | MissionStatus::Settled
    ) {
        return Err(MissionError::InvalidStateTransition.into());
    }

    let (expected_verification, verification_bump) =
        verification_pda(program_id, mission_account.key);
    require_account_key(
        verification_account,
        &expected_verification,
        MissionError::InvalidPda,
    )?;

    let now = Clock::get()?.unix_timestamp;
    let verification = if verification_account.data_is_empty() {
        create_pda_account(
            verifier,
            verification_account,
            system_program,
            program_id,
            VerificationRecord::LEN,
            &[
                b"verification",
                mission_account.key.as_ref(),
                &[verification_bump],
            ],
        )?;
        VerificationRecord {
            discriminator: VerificationRecord::DISCRIMINATOR,
            version: 1,
            status: if args.approved {
                VerificationStatus::Approved
            } else {
                VerificationStatus::Rejected
            },
            bump: verification_bump,
            reserved0: 0,
            mission: *mission_account.key,
            verifier: *verifier.key,
            artifact_hash: args.artifact_hash,
            proof_hash: args.proof_hash,
            output_hash: args.output_hash,
            challenged_by: Pubkey::default(),
            verified_at: now,
            challenge_window_end: now
                .checked_add(mission.challenge_window_seconds)
                .ok_or(MissionError::ArithmeticOverflow)?,
            reserved: [0; 44],
        }
    } else {
        require_owner(verification_account, program_id)?;
        let mut verification: VerificationRecord = read_state(verification_account)?;
        if verification.challenged_by != Pubkey::default()
            || verification.status == VerificationStatus::Challenged
        {
            return Err(MissionError::VerificationChallenged.into());
        }
        verification.status = if args.approved {
            VerificationStatus::Approved
        } else {
            VerificationStatus::Rejected
        };
        verification.artifact_hash = args.artifact_hash;
        verification.proof_hash = args.proof_hash;
        verification.output_hash = args.output_hash;
        verification.challenged_by = Pubkey::default();
        verification.verified_at = now;
        verification.challenge_window_end = now
            .checked_add(mission.challenge_window_seconds)
            .ok_or(MissionError::ArithmeticOverflow)?;
        verification
    };

    mission.status = MissionStatus::Verifying;
    mission.result_hash = if args.approved {
        args.output_hash
    } else {
        [0; 32]
    };

    write_state(mission_account, &mission)?;
    write_state(verification_account, &verification)?;
    emit_verification_submitted(*mission_account.key, *verifier.key, args.approved);
    Ok(())
}

pub fn challenge_verification(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: ChallengeVerificationArgs,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let creator = next_account_info(accounts_iter)?;
    let mission_account = next_account_info(accounts_iter)?;
    let verification_account = next_account_info(accounts_iter)?;
    let dispute_account = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;

    require_signer(creator)?;
    require_owner(mission_account, program_id)?;
    require_owner(verification_account, program_id)?;
    require_system_program(system_program)?;

    let mission: Mission = read_state(mission_account)?;
    let mut verification: VerificationRecord = read_state(verification_account)?;
    if mission.creator != *creator.key {
        return Err(MissionError::InvalidAuthority.into());
    }
    if verification.mission != *mission_account.key
        || verification.status != VerificationStatus::Approved
    {
        return Err(MissionError::VerificationNotApproved.into());
    }

    let now = Clock::get()?.unix_timestamp;
    if now > verification.challenge_window_end {
        return Err(MissionError::ChallengeWindowClosed.into());
    }

    let (expected_dispute, dispute_bump) = dispute_pda(program_id, verification_account.key);
    require_account_key(dispute_account, &expected_dispute, MissionError::InvalidPda)?;
    create_pda_account(
        creator,
        dispute_account,
        system_program,
        program_id,
        DisputeRecord::LEN,
        &[
            b"dispute",
            verification_account.key.as_ref(),
            &[dispute_bump],
        ],
    )?;

    let dispute = DisputeRecord {
        discriminator: DisputeRecord::DISCRIMINATOR,
        version: 1,
        status: DisputeStatus::Open,
        bump: dispute_bump,
        outcome: 0,
        mission: *mission_account.key,
        verification: *verification_account.key,
        challenger: *creator.key,
        resolver: Pubkey::default(),
        reason_hash: args.reason_hash,
        opened_at: now,
        resolved_at: 0,
        reserved: [0; 76],
    };

    verification.status = VerificationStatus::Challenged;
    verification.challenged_by = *creator.key;
    write_state(verification_account, &verification)?;
    write_state(dispute_account, &dispute)
}

pub fn resolve_dispute(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: ResolveDisputeArgs,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let verifier = next_account_info(accounts_iter)?;
    let mission_account = next_account_info(accounts_iter)?;
    let verification_account = next_account_info(accounts_iter)?;
    let dispute_account = next_account_info(accounts_iter)?;

    require_signer(verifier)?;
    require_owner(mission_account, program_id)?;
    require_owner(verification_account, program_id)?;
    require_owner(dispute_account, program_id)?;

    let mut mission: Mission = read_state(mission_account)?;
    let mut verification: VerificationRecord = read_state(verification_account)?;
    let mut dispute: DisputeRecord = read_state(dispute_account)?;

    if mission.verifier != *verifier.key {
        return Err(MissionError::InvalidVerifier.into());
    }
    if dispute.status != DisputeStatus::Open {
        return Err(MissionError::DisputeNotOpen.into());
    }
    if dispute.mission != *mission_account.key || dispute.verification != *verification_account.key
    {
        return Err(MissionError::InvalidAccountData.into());
    }

    let now = Clock::get()?.unix_timestamp;
    if args.uphold_verification {
        verification.status = VerificationStatus::Approved;
    } else {
        verification.status = VerificationStatus::Rejected;
        mission.result_hash = [0; 32];
    }
    dispute.status = if args.uphold_verification {
        DisputeStatus::ResolvedUpheld
    } else {
        DisputeStatus::ResolvedRejected
    };
    dispute.resolver = *verifier.key;
    dispute.resolved_at = now;

    write_state(mission_account, &mission)?;
    write_state(verification_account, &verification)?;
    write_state(dispute_account, &dispute)
}
