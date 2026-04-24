use solana_program::program_error::ProgramError;

#[derive(Debug, Copy, Clone)]
pub enum MissionError {
    MissingSigner = 0,
    InvalidAccountOwner = 1,
    InvalidAccountData = 2,
    InvalidPda = 3,
    InvalidAuthority = 4,
    InvalidVerifier = 5,
    InvalidStateTransition = 6,
    InvalidInstruction = 7,
    InvalidSystemProgram = 8,
    InvalidTokenProgram = 9,
    InvalidAssociatedTokenProgram = 10,
    InvalidMint = 11,
    InvalidTokenAccount = 12,
    InvalidTokenOwner = 13,
    AccountTooSmall = 14,
    AccountAlreadyInitialized = 15,
    AmountMustBePositive = 16,
    ArithmeticOverflow = 17,
    MissionNotFunded = 18,
    MissionNotActive = 19,
    MissionPaused = 20,
    MissionCancelled = 21,
    MissionAlreadySettled = 22,
    BudgetExceeded = 23,
    AllocationExceeded = 24,
    ProviderNotApproved = 25,
    SpendNotPending = 26,
    SpendNotApproved = 27,
    SpendExpired = 28,
    SpendAlreadyExecuted = 29,
    VerificationNotApproved = 30,
    VerificationRejected = 31,
    VerificationChallenged = 32,
    ChallengeWindowStillOpen = 33,
    ChallengeWindowClosed = 34,
    DisputeNotOpen = 35,
    RefundNotAllowed = 36,
    AllocationNotActive = 37,
    AllocationHasOutstandingBudget = 38,
    InvalidProtocolConfig = 39,
    MintNotAllowed = 40,
    ProtocolPaused = 41,
    AgentRegistrationPaused = 42,
    AgentNotActive = 43,
    InvalidAgentRegistry = 44,
    FeeTooHigh = 45,
    AllocationAlreadyFinalized = 46,
}

impl From<MissionError> for ProgramError {
    fn from(error: MissionError) -> Self {
        ProgramError::Custom(error as u32)
    }
}
