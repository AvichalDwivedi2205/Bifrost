use borsh::BorshDeserialize;
use missionmesh_program::{
    error::MissionError,
    instruction::{
        ApproveSpendArgs, ChallengeVerificationArgs, CreateAllocationArgs, CreateMissionArgs,
        ExecuteSpendArgs, FinalizeAllocationArgs, FundMissionArgs, InitializeProtocolArgs,
        MissionInstruction, RefundMissionArgs, RegisterAgentArgs, RequestSpendArgs,
        ResolveDisputeArgs, SettleAllocationArgs, SubmitVerificationArgs, UpdateAgentArgs,
        UpdateProtocolArgs, UpsertProviderPolicyArgs,
    },
    process_instruction,
    state::{
        AccountSize, AgentRegistry, AgentReputation, AgentStatus, Allocation, AllocationStatus,
        DisputeRecord, DisputeStatus, Mission, MissionStatus, PrivacyMode, ProtocolConfig,
        SpendRequest, SpendStatus, VerificationMode, VerificationRecord, VerificationStatus,
    },
};
use serial_test::serial;
use solana_program::{
    instruction::{AccountMeta, Instruction},
    program_pack::Pack,
    pubkey::Pubkey,
    system_instruction, system_program,
};
use solana_program_test::{processor, BanksClientError, ProgramTest, ProgramTestContext};
use solana_sdk::{
    account::AccountSharedData,
    clock::Clock,
    instruction::InstructionError,
    signature::{Keypair, Signer},
    transaction::{Transaction, TransactionError},
};
use spl_associated_token_account::{
    get_associated_token_address_with_program_id, instruction::create_associated_token_account,
};
use spl_token::{
    instruction as token_instruction,
    state::{Account as TokenAccount, Mint},
};

const DECIMALS: u8 = 6;
const DEFAULT_FEE_BPS: u16 = 500;

#[derive(Clone, Copy)]
struct MissionAddrs {
    mission_ref: [u8; 32],
    mission: Pubkey,
    vault_authority: Pubkey,
    mission_vault_ata: Pubkey,
    verification: Pubkey,
}

#[derive(Clone, Copy)]
struct AllocationAddrs {
    allocation_ref: [u8; 32],
    request_ref: [u8; 32],
    allocation: Pubkey,
    provider_policy: Pubkey,
    request: Pubkey,
    receipt: Pubkey,
    reputation: Pubkey,
}

struct Harness {
    program_id: Pubkey,
    context: ProgramTestContext,
    config: Pubkey,
    mint: Keypair,
    verifier: Keypair,
    agent: Keypair,
    provider: Keypair,
    treasury: Keypair,
    agent_registry: Pubkey,
    creator_ata: Pubkey,
    agent_ata: Pubkey,
    provider_ata: Pubkey,
    treasury_ata: Pubkey,
    current_slot: u64,
}

impl Harness {
    async fn new(protocol_fee_bps: u16) -> Self {
        let program_id = Pubkey::new_unique();
        let mut program_test = ProgramTest::new(
            "missionmesh_program",
            program_id,
            processor!(process_instruction),
        );
        program_test.add_program(
            "spl_token",
            spl_token::id(),
            processor!(spl_token::processor::Processor::process),
        );
        program_test.add_program(
            "spl_associated_token_account",
            spl_associated_token_account::id(),
            processor!(spl_associated_token_account::processor::process_instruction),
        );

        let mut context = program_test.start_with_context().await;
        let current_slot = context
            .banks_client
            .get_sysvar::<Clock>()
            .await
            .unwrap()
            .slot;

        let mint = Keypair::new();
        let verifier = Keypair::new();
        let agent = Keypair::new();
        let provider = Keypair::new();
        let treasury = Keypair::new();
        let config = protocol_config_pda(&program_id);
        let agent_registry = agent_registry_pda(&program_id, &agent.pubkey());

        let creator_ata = get_associated_token_address_with_program_id(
            &context.payer.pubkey(),
            &mint.pubkey(),
            &spl_token::id(),
        );
        let agent_ata = get_associated_token_address_with_program_id(
            &agent.pubkey(),
            &mint.pubkey(),
            &spl_token::id(),
        );
        let provider_ata = get_associated_token_address_with_program_id(
            &provider.pubkey(),
            &mint.pubkey(),
            &spl_token::id(),
        );
        let treasury_ata = get_associated_token_address_with_program_id(
            &treasury.pubkey(),
            &mint.pubkey(),
            &spl_token::id(),
        );

        let mut harness = Self {
            program_id,
            context,
            config,
            mint,
            verifier,
            agent,
            provider,
            treasury,
            agent_registry,
            creator_ata,
            agent_ata,
            provider_ata,
            treasury_ata,
            current_slot,
        };

        harness.fund_signer(&harness.verifier.pubkey()).await;
        harness.fund_signer(&harness.agent.pubkey()).await;
        harness.fund_signer(&harness.provider.pubkey()).await;
        harness.fund_signer(&harness.treasury.pubkey()).await;
        harness.create_main_mint_and_seed_accounts().await;
        harness
            .initialize_protocol(protocol_fee_bps, false, false)
            .await;
        harness.register_default_agent().await;
        harness
    }

    async fn fund_signer(&mut self, recipient: &Pubkey) {
        self.send_payer(
            &[system_instruction::transfer(
                &self.context.payer.pubkey(),
                recipient,
                2_000_000_000,
            )],
            &[],
        )
        .await
        .unwrap();
    }

    async fn create_main_mint_and_seed_accounts(&mut self) {
        let rent = self.context.banks_client.get_rent().await.unwrap();
        let mint_rent = rent.minimum_balance(Mint::LEN);

        self.send_payer_with_main_mint(&[
            system_instruction::create_account(
                &self.context.payer.pubkey(),
                &self.mint.pubkey(),
                mint_rent,
                Mint::LEN as u64,
                &spl_token::id(),
            ),
            token_instruction::initialize_mint(
                &spl_token::id(),
                &self.mint.pubkey(),
                &self.context.payer.pubkey(),
                None,
                DECIMALS,
            )
            .unwrap(),
        ])
        .await
        .unwrap();

        for owner in [
            self.context.payer.pubkey(),
            self.agent.pubkey(),
            self.provider.pubkey(),
            self.treasury.pubkey(),
        ] {
            self.send_payer(
                &[create_associated_token_account(
                    &self.context.payer.pubkey(),
                    &owner,
                    &self.mint.pubkey(),
                    &spl_token::id(),
                )],
                &[],
            )
            .await
            .unwrap();
        }

        self.send_payer(
            &[token_instruction::mint_to(
                &spl_token::id(),
                &self.mint.pubkey(),
                &self.creator_ata,
                &self.context.payer.pubkey(),
                &[],
                1_000_000_000,
            )
            .unwrap()],
            &[],
        )
        .await
        .unwrap();
    }

    async fn create_extra_mint(&mut self) -> Keypair {
        let mint = Keypair::new();
        let rent = self.context.banks_client.get_rent().await.unwrap();
        let mint_rent = rent.minimum_balance(Mint::LEN);
        self.send_payer(
            &[
                system_instruction::create_account(
                    &self.context.payer.pubkey(),
                    &mint.pubkey(),
                    mint_rent,
                    Mint::LEN as u64,
                    &spl_token::id(),
                ),
                token_instruction::initialize_mint(
                    &spl_token::id(),
                    &mint.pubkey(),
                    &self.context.payer.pubkey(),
                    None,
                    DECIMALS,
                )
                .unwrap(),
            ],
            &[&mint],
        )
        .await
        .unwrap();
        mint
    }

    async fn initialize_protocol(
        &mut self,
        fee_bps: u16,
        mission_creation_paused: bool,
        agent_registration_paused: bool,
    ) {
        self.send_payer(
            &[initialize_protocol_ix(
                self.program_id,
                self.context.payer.pubkey(),
                self.config,
                InitializeProtocolArgs {
                    treasury: self.treasury.pubkey(),
                    allowed_mint: self.mint.pubkey(),
                    protocol_fee_bps: fee_bps,
                    mission_creation_paused,
                    agent_registration_paused,
                },
            )],
            &[],
        )
        .await
        .unwrap();
    }

    async fn update_protocol(
        &mut self,
        fee_bps: u16,
        mission_creation_paused: bool,
        agent_registration_paused: bool,
        allowed_mint: Pubkey,
    ) {
        self.send_payer(
            &[update_protocol_ix(
                self.program_id,
                self.context.payer.pubkey(),
                self.config,
                UpdateProtocolArgs {
                    treasury: self.treasury.pubkey(),
                    allowed_mint,
                    protocol_fee_bps: fee_bps,
                    mission_creation_paused,
                    agent_registration_paused,
                },
            )],
            &[],
        )
        .await
        .unwrap();
    }

    async fn register_agent_for(&mut self, agent: &Keypair, payout_wallet: Pubkey) -> Pubkey {
        let registry = agent_registry_pda(&self.program_id, &agent.pubkey());
        self.send_from(
            agent,
            &[register_agent_ix(
                self.program_id,
                agent.pubkey(),
                self.config,
                registry,
                payout_wallet,
                RegisterAgentArgs {
                    metadata_hash: [11; 32],
                    capability_hash: [12; 32],
                    verifier: self.verifier.pubkey(),
                    privacy_policy_hash: [13; 32],
                },
            )],
            &[],
        )
        .await
        .unwrap();
        registry
    }

    async fn register_default_agent(&mut self) {
        let registry = self.register_agent_ix_for_default_agent();
        self.send_agent(&[registry]).await.unwrap();
    }

    fn register_agent_ix_for_default_agent(&self) -> Instruction {
        register_agent_ix(
            self.program_id,
            self.agent.pubkey(),
            self.config,
            self.agent_registry,
            self.agent.pubkey(),
            RegisterAgentArgs {
                metadata_hash: [11; 32],
                capability_hash: [12; 32],
                verifier: self.verifier.pubkey(),
                privacy_policy_hash: [13; 32],
            },
        )
    }

    async fn update_default_agent(&mut self, active: bool) {
        self.send_payer(
            &[update_agent_ix(
                self.program_id,
                self.context.payer.pubkey(),
                self.config,
                self.agent_registry,
                self.agent.pubkey(),
                self.agent.pubkey(),
                UpdateAgentArgs {
                    metadata_hash: [21; 32],
                    capability_hash: [22; 32],
                    verifier: self.verifier.pubkey(),
                    privacy_policy_hash: [23; 32],
                    active,
                },
            )],
            &[],
        )
        .await
        .unwrap();
    }

    fn mission_addrs(&self, mission_ref: [u8; 32], mint: Pubkey) -> MissionAddrs {
        let mission = mission_pda(&self.program_id, &self.context.payer.pubkey(), &mission_ref);
        let vault_authority = vault_authority_pda(&self.program_id, &mission);
        let mission_vault_ata =
            get_associated_token_address_with_program_id(&vault_authority, &mint, &spl_token::id());
        let verification = verification_pda(&self.program_id, &mission);
        MissionAddrs {
            mission_ref,
            mission,
            vault_authority,
            mission_vault_ata,
            verification,
        }
    }

    fn allocation_addrs(
        &self,
        mission: &MissionAddrs,
        allocation_ref: [u8; 32],
        request_ref: [u8; 32],
    ) -> AllocationAddrs {
        let allocation = allocation_pda(
            &self.program_id,
            &mission.mission,
            &self.agent.pubkey(),
            &allocation_ref,
        );
        let provider_policy =
            provider_policy_pda(&self.program_id, &allocation, &self.provider.pubkey());
        let request = request_pda(&self.program_id, &allocation, &request_ref);
        let receipt = receipt_pda(&self.program_id, &request);
        let reputation = reputation_pda(&self.program_id, &self.agent.pubkey());
        AllocationAddrs {
            allocation_ref,
            request_ref,
            allocation,
            provider_policy,
            request,
            receipt,
            reputation,
        }
    }

    async fn create_mission(&mut self, addrs: &MissionAddrs, mint: Pubkey, total_budget: u64) {
        self.send_payer(
            &[create_mission_ix(
                self.program_id,
                self.context.payer.pubkey(),
                self.config,
                addrs,
                mint,
                CreateMissionArgs {
                    mission_ref: addrs.mission_ref,
                    metadata_hash: [31; 32],
                    private_manifest_hash: [32; 32],
                    budget_commitment_hash: [33; 32],
                    verifier: self.verifier.pubkey(),
                    total_budget,
                    privacy_mode: PrivacyMode::Hybrid,
                    verification_mode: VerificationMode::Verifier,
                    challenge_window_seconds: 1,
                },
            )],
            &[],
        )
        .await
        .unwrap();
    }

    async fn fund_mission(&mut self, addrs: &MissionAddrs, amount: u64) {
        self.send_payer(
            &[fund_mission_ix(
                self.program_id,
                self.context.payer.pubkey(),
                addrs,
                self.creator_ata,
                self.mint.pubkey(),
                amount,
            )],
            &[],
        )
        .await
        .unwrap();
    }

    async fn activate_mission(&mut self, addrs: &MissionAddrs) {
        self.send_payer(
            &[activate_mission_ix(
                self.program_id,
                self.context.payer.pubkey(),
                addrs.mission,
            )],
            &[],
        )
        .await
        .unwrap();
    }

    async fn pause_mission(&mut self, addrs: &MissionAddrs) {
        self.send_payer(
            &[pause_mission_ix(
                self.program_id,
                self.context.payer.pubkey(),
                addrs.mission,
            )],
            &[],
        )
        .await
        .unwrap();
    }

    async fn create_default_allocation(
        &mut self,
        mission: &MissionAddrs,
        addrs: &AllocationAddrs,
        spend_budget_cap: u64,
        payout_cap: u64,
        max_per_call: u64,
        human_approval_above: u64,
    ) {
        self.send_payer(
            &[create_allocation_ix(
                self.program_id,
                self.context.payer.pubkey(),
                mission.mission,
                addrs.allocation,
                self.agent_registry,
                self.agent.pubkey(),
                self.agent.pubkey(),
                CreateAllocationArgs {
                    allocation_ref: addrs.allocation_ref,
                    spend_budget_cap,
                    payout_cap,
                    max_per_call,
                    human_approval_above,
                    policy_commitment_hash: [41; 32],
                },
            )],
            &[],
        )
        .await
        .unwrap();
    }

    async fn upsert_default_provider_policy(
        &mut self,
        mission: &MissionAddrs,
        addrs: &AllocationAddrs,
        per_call_cap: u64,
        total_cap: u64,
        active: bool,
    ) {
        self.send_payer(
            &[upsert_provider_policy_ix(
                self.program_id,
                self.context.payer.pubkey(),
                mission.mission,
                addrs.allocation,
                addrs.provider_policy,
                self.provider.pubkey(),
                UpsertProviderPolicyArgs {
                    per_call_cap,
                    total_cap,
                    active,
                },
            )],
            &[],
        )
        .await
        .unwrap();
    }

    async fn send_from(
        &mut self,
        fee_payer: &Keypair,
        instructions: &[Instruction],
        extra_signers: &[&Keypair],
    ) -> Result<(), BanksClientError> {
        let mut signers: Vec<&Keypair> = vec![fee_payer];
        signers.extend_from_slice(extra_signers);
        let latest_blockhash = self
            .context
            .banks_client
            .get_latest_blockhash()
            .await
            .unwrap();
        let tx = Transaction::new_signed_with_payer(
            instructions,
            Some(&fee_payer.pubkey()),
            &signers,
            latest_blockhash,
        );
        let result = self.context.banks_client.process_transaction(tx).await;
        if result.is_ok() {
            self.current_slot = self.current_slot.saturating_add(1);
            self.context.warp_to_slot(self.current_slot).unwrap();
        }
        result
    }

    async fn send_payer(
        &mut self,
        instructions: &[Instruction],
        extra_signers: &[&Keypair],
    ) -> Result<(), BanksClientError> {
        let mut signers: Vec<&Keypair> = vec![&self.context.payer];
        signers.extend_from_slice(extra_signers);
        let latest_blockhash = self
            .context
            .banks_client
            .get_latest_blockhash()
            .await
            .unwrap();
        let tx = Transaction::new_signed_with_payer(
            instructions,
            Some(&self.context.payer.pubkey()),
            &signers,
            latest_blockhash,
        );
        let result = self.context.banks_client.process_transaction(tx).await;
        if result.is_ok() {
            self.current_slot = self.current_slot.saturating_add(1);
            self.context.warp_to_slot(self.current_slot).unwrap();
        }
        result
    }

    async fn send_payer_with_main_mint(
        &mut self,
        instructions: &[Instruction],
    ) -> Result<(), BanksClientError> {
        let latest_blockhash = self
            .context
            .banks_client
            .get_latest_blockhash()
            .await
            .unwrap();
        let tx = Transaction::new_signed_with_payer(
            instructions,
            Some(&self.context.payer.pubkey()),
            &[&self.context.payer, &self.mint],
            latest_blockhash,
        );
        let result = self.context.banks_client.process_transaction(tx).await;
        if result.is_ok() {
            self.current_slot = self.current_slot.saturating_add(1);
            self.context.warp_to_slot(self.current_slot).unwrap();
        }
        result
    }

    async fn send_agent(&mut self, instructions: &[Instruction]) -> Result<(), BanksClientError> {
        let latest_blockhash = self
            .context
            .banks_client
            .get_latest_blockhash()
            .await
            .unwrap();
        let tx = Transaction::new_signed_with_payer(
            instructions,
            Some(&self.agent.pubkey()),
            &[&self.agent],
            latest_blockhash,
        );
        let result = self.context.banks_client.process_transaction(tx).await;
        if result.is_ok() {
            self.current_slot = self.current_slot.saturating_add(1);
            self.context.warp_to_slot(self.current_slot).unwrap();
        }
        result
    }

    async fn send_verifier(
        &mut self,
        instructions: &[Instruction],
    ) -> Result<(), BanksClientError> {
        let latest_blockhash = self
            .context
            .banks_client
            .get_latest_blockhash()
            .await
            .unwrap();
        let tx = Transaction::new_signed_with_payer(
            instructions,
            Some(&self.verifier.pubkey()),
            &[&self.verifier],
            latest_blockhash,
        );
        let result = self.context.banks_client.process_transaction(tx).await;
        if result.is_ok() {
            self.current_slot = self.current_slot.saturating_add(1);
            self.context.warp_to_slot(self.current_slot).unwrap();
        }
        result
    }

    async fn get_clock(&mut self) -> Clock {
        self.context.banks_client.get_sysvar().await.unwrap()
    }

    async fn advance_time_by(&mut self, seconds: i64) {
        let start = self.get_clock().await.unix_timestamp;
        while self.get_clock().await.unix_timestamp <= start + seconds {
            self.current_slot = self.current_slot.saturating_add(400);
            self.context.warp_to_slot(self.current_slot).unwrap();
        }
    }

    async fn get_token_balance(&mut self, address: Pubkey) -> u64 {
        let account = self
            .context
            .banks_client
            .get_account(address)
            .await
            .unwrap()
            .unwrap();
        TokenAccount::unpack(&account.data).unwrap().amount
    }

    async fn read_program_state<T: BorshDeserialize>(&mut self, address: Pubkey) -> T {
        let account = self
            .context
            .banks_client
            .get_account(address)
            .await
            .unwrap()
            .unwrap();
        let mut slice = account.data.as_slice();
        T::deserialize(&mut slice).unwrap()
    }
}

fn protocol_config_pda(program_id: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"config"], program_id).0
}

fn agent_registry_pda(program_id: &Pubkey, agent: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"agent-registry", agent.as_ref()], program_id).0
}

fn mission_pda(program_id: &Pubkey, creator: &Pubkey, mission_ref: &[u8; 32]) -> Pubkey {
    Pubkey::find_program_address(&[b"mission", creator.as_ref(), mission_ref], program_id).0
}

fn vault_authority_pda(program_id: &Pubkey, mission: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"vault-authority", mission.as_ref()], program_id).0
}

fn allocation_pda(
    program_id: &Pubkey,
    mission: &Pubkey,
    agent: &Pubkey,
    allocation_ref: &[u8; 32],
) -> Pubkey {
    Pubkey::find_program_address(
        &[
            b"allocation",
            mission.as_ref(),
            agent.as_ref(),
            allocation_ref,
        ],
        program_id,
    )
    .0
}

fn provider_policy_pda(program_id: &Pubkey, allocation: &Pubkey, provider: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[b"provider-policy", allocation.as_ref(), provider.as_ref()],
        program_id,
    )
    .0
}

fn request_pda(program_id: &Pubkey, allocation: &Pubkey, request_ref: &[u8; 32]) -> Pubkey {
    Pubkey::find_program_address(
        &[b"spend-request", allocation.as_ref(), request_ref],
        program_id,
    )
    .0
}

fn receipt_pda(program_id: &Pubkey, request: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"receipt", request.as_ref()], program_id).0
}

fn verification_pda(program_id: &Pubkey, mission: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"verification", mission.as_ref()], program_id).0
}

fn dispute_pda(program_id: &Pubkey, verification: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"dispute", verification.as_ref()], program_id).0
}

fn reputation_pda(program_id: &Pubkey, agent: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"reputation", agent.as_ref()], program_id).0
}

fn mission_ix(
    program_id: Pubkey,
    accounts: Vec<AccountMeta>,
    data: MissionInstruction,
) -> Instruction {
    Instruction::new_with_borsh(program_id, &data, accounts)
}

fn initialize_protocol_ix(
    program_id: Pubkey,
    admin: Pubkey,
    config: Pubkey,
    args: InitializeProtocolArgs,
) -> Instruction {
    mission_ix(
        program_id,
        vec![
            AccountMeta::new(admin, true),
            AccountMeta::new(config, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        MissionInstruction::InitializeProtocol(args),
    )
}

fn update_protocol_ix(
    program_id: Pubkey,
    admin: Pubkey,
    config: Pubkey,
    args: UpdateProtocolArgs,
) -> Instruction {
    mission_ix(
        program_id,
        vec![
            AccountMeta::new(admin, true),
            AccountMeta::new(config, false),
        ],
        MissionInstruction::UpdateProtocol(args),
    )
}

fn register_agent_ix(
    program_id: Pubkey,
    agent: Pubkey,
    config: Pubkey,
    registry: Pubkey,
    payout_wallet: Pubkey,
    args: RegisterAgentArgs,
) -> Instruction {
    mission_ix(
        program_id,
        vec![
            AccountMeta::new(agent, true),
            AccountMeta::new_readonly(config, false),
            AccountMeta::new(registry, false),
            AccountMeta::new_readonly(payout_wallet, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        MissionInstruction::RegisterAgent(args),
    )
}

fn update_agent_ix(
    program_id: Pubkey,
    authority: Pubkey,
    config: Pubkey,
    registry: Pubkey,
    agent: Pubkey,
    payout_wallet: Pubkey,
    args: UpdateAgentArgs,
) -> Instruction {
    mission_ix(
        program_id,
        vec![
            AccountMeta::new(authority, true),
            AccountMeta::new_readonly(config, false),
            AccountMeta::new(registry, false),
            AccountMeta::new_readonly(agent, false),
            AccountMeta::new_readonly(payout_wallet, false),
        ],
        MissionInstruction::UpdateAgent(args),
    )
}

fn create_mission_ix(
    program_id: Pubkey,
    creator: Pubkey,
    config: Pubkey,
    addrs: &MissionAddrs,
    mint: Pubkey,
    args: CreateMissionArgs,
) -> Instruction {
    mission_ix(
        program_id,
        vec![
            AccountMeta::new(creator, true),
            AccountMeta::new_readonly(config, false),
            AccountMeta::new(addrs.mission, false),
            AccountMeta::new_readonly(addrs.vault_authority, false),
            AccountMeta::new(addrs.mission_vault_ata, false),
            AccountMeta::new_readonly(mint, false),
            AccountMeta::new_readonly(system_program::id(), false),
            AccountMeta::new_readonly(spl_token::id(), false),
            AccountMeta::new_readonly(spl_associated_token_account::id(), false),
        ],
        MissionInstruction::CreateMission(args),
    )
}

fn fund_mission_ix(
    program_id: Pubkey,
    creator: Pubkey,
    addrs: &MissionAddrs,
    creator_ata: Pubkey,
    mint: Pubkey,
    amount: u64,
) -> Instruction {
    mission_ix(
        program_id,
        vec![
            AccountMeta::new(creator, true),
            AccountMeta::new(addrs.mission, false),
            AccountMeta::new(creator_ata, false),
            AccountMeta::new(addrs.mission_vault_ata, false),
            AccountMeta::new_readonly(mint, false),
            AccountMeta::new_readonly(spl_token::id(), false),
        ],
        MissionInstruction::FundMission(FundMissionArgs { amount }),
    )
}

fn activate_mission_ix(program_id: Pubkey, creator: Pubkey, mission: Pubkey) -> Instruction {
    mission_ix(
        program_id,
        vec![
            AccountMeta::new(creator, true),
            AccountMeta::new(mission, false),
        ],
        MissionInstruction::ActivateMission,
    )
}

fn pause_mission_ix(program_id: Pubkey, creator: Pubkey, mission: Pubkey) -> Instruction {
    mission_ix(
        program_id,
        vec![
            AccountMeta::new(creator, true),
            AccountMeta::new(mission, false),
        ],
        MissionInstruction::PauseMission,
    )
}

fn cancel_mission_ix(program_id: Pubkey, creator: Pubkey, mission: Pubkey) -> Instruction {
    mission_ix(
        program_id,
        vec![
            AccountMeta::new(creator, true),
            AccountMeta::new(mission, false),
        ],
        MissionInstruction::CancelMission,
    )
}

fn create_allocation_ix(
    program_id: Pubkey,
    creator: Pubkey,
    mission: Pubkey,
    allocation: Pubkey,
    agent_registry: Pubkey,
    agent: Pubkey,
    payout_wallet: Pubkey,
    args: CreateAllocationArgs,
) -> Instruction {
    mission_ix(
        program_id,
        vec![
            AccountMeta::new(creator, true),
            AccountMeta::new(mission, false),
            AccountMeta::new(allocation, false),
            AccountMeta::new_readonly(agent_registry, false),
            AccountMeta::new_readonly(agent, false),
            AccountMeta::new_readonly(payout_wallet, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        MissionInstruction::CreateAllocation(args),
    )
}

fn upsert_provider_policy_ix(
    program_id: Pubkey,
    creator: Pubkey,
    mission: Pubkey,
    allocation: Pubkey,
    provider_policy: Pubkey,
    provider: Pubkey,
    args: UpsertProviderPolicyArgs,
) -> Instruction {
    mission_ix(
        program_id,
        vec![
            AccountMeta::new(creator, true),
            AccountMeta::new_readonly(mission, false),
            AccountMeta::new(allocation, false),
            AccountMeta::new(provider_policy, false),
            AccountMeta::new_readonly(provider, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        MissionInstruction::UpsertProviderPolicy(args),
    )
}

fn request_spend_ix(
    program_id: Pubkey,
    agent: Pubkey,
    mission: Pubkey,
    allocation: Pubkey,
    provider_policy: Pubkey,
    request: Pubkey,
    args: RequestSpendArgs,
) -> Instruction {
    mission_ix(
        program_id,
        vec![
            AccountMeta::new(agent, true),
            AccountMeta::new_readonly(mission, false),
            AccountMeta::new_readonly(allocation, false),
            AccountMeta::new_readonly(provider_policy, false),
            AccountMeta::new(request, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        MissionInstruction::RequestSpend(args),
    )
}

fn approve_spend_ix(
    program_id: Pubkey,
    creator: Pubkey,
    mission: Pubkey,
    allocation: Pubkey,
    request: Pubkey,
    approve: bool,
) -> Instruction {
    mission_ix(
        program_id,
        vec![
            AccountMeta::new(creator, true),
            AccountMeta::new_readonly(mission, false),
            AccountMeta::new_readonly(allocation, false),
            AccountMeta::new(request, false),
        ],
        MissionInstruction::ApproveSpend(ApproveSpendArgs { approve }),
    )
}

fn execute_spend_ix(
    program_id: Pubkey,
    actor: Pubkey,
    mission: &MissionAddrs,
    addrs: &AllocationAddrs,
    provider_ata: Pubkey,
    provider: Pubkey,
    mint: Pubkey,
    memo_hash: [u8; 32],
    tx_ref_hash: [u8; 32],
) -> Instruction {
    mission_ix(
        program_id,
        vec![
            AccountMeta::new(actor, true),
            AccountMeta::new(mission.mission, false),
            AccountMeta::new(addrs.allocation, false),
            AccountMeta::new(addrs.provider_policy, false),
            AccountMeta::new(addrs.request, false),
            AccountMeta::new(addrs.receipt, false),
            AccountMeta::new(mission.mission_vault_ata, false),
            AccountMeta::new_readonly(mission.vault_authority, false),
            AccountMeta::new(provider_ata, false),
            AccountMeta::new_readonly(provider, false),
            AccountMeta::new_readonly(mint, false),
            AccountMeta::new_readonly(spl_token::id(), false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        MissionInstruction::ExecuteSpend(ExecuteSpendArgs {
            memo_hash,
            tx_ref_hash,
        }),
    )
}

fn submit_verification_ix(
    program_id: Pubkey,
    verifier: Pubkey,
    mission: Pubkey,
    verification: Pubkey,
    args: SubmitVerificationArgs,
) -> Instruction {
    mission_ix(
        program_id,
        vec![
            AccountMeta::new(verifier, true),
            AccountMeta::new(mission, false),
            AccountMeta::new(verification, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        MissionInstruction::SubmitVerification(args),
    )
}

fn challenge_verification_ix(
    program_id: Pubkey,
    creator: Pubkey,
    mission: Pubkey,
    verification: Pubkey,
    dispute: Pubkey,
    args: ChallengeVerificationArgs,
) -> Instruction {
    mission_ix(
        program_id,
        vec![
            AccountMeta::new(creator, true),
            AccountMeta::new_readonly(mission, false),
            AccountMeta::new(verification, false),
            AccountMeta::new(dispute, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        MissionInstruction::ChallengeVerification(args),
    )
}

fn resolve_dispute_ix(
    program_id: Pubkey,
    verifier: Pubkey,
    mission: Pubkey,
    verification: Pubkey,
    dispute: Pubkey,
    uphold_verification: bool,
) -> Instruction {
    mission_ix(
        program_id,
        vec![
            AccountMeta::new(verifier, true),
            AccountMeta::new(mission, false),
            AccountMeta::new(verification, false),
            AccountMeta::new(dispute, false),
        ],
        MissionInstruction::ResolveDispute(ResolveDisputeArgs {
            uphold_verification,
        }),
    )
}

fn settle_allocation_ix(
    program_id: Pubkey,
    creator: Pubkey,
    config: Pubkey,
    mission: &MissionAddrs,
    addrs: &AllocationAddrs,
    agent_ata: Pubkey,
    treasury_ata: Pubkey,
    mint: Pubkey,
    amount: u64,
) -> Instruction {
    mission_ix(
        program_id,
        vec![
            AccountMeta::new(creator, true),
            AccountMeta::new_readonly(config, false),
            AccountMeta::new(mission.mission, false),
            AccountMeta::new(addrs.allocation, false),
            AccountMeta::new_readonly(mission.verification, false),
            AccountMeta::new(mission.mission_vault_ata, false),
            AccountMeta::new_readonly(mission.vault_authority, false),
            AccountMeta::new(agent_ata, false),
            AccountMeta::new(treasury_ata, false),
            AccountMeta::new_readonly(mint, false),
            AccountMeta::new_readonly(spl_token::id(), false),
        ],
        MissionInstruction::SettleAllocation(SettleAllocationArgs { amount }),
    )
}

fn finalize_allocation_ix(
    program_id: Pubkey,
    creator: Pubkey,
    mission: Pubkey,
    allocation: Pubkey,
    reputation: Pubkey,
    verification: Option<Pubkey>,
    successful: bool,
) -> Instruction {
    let mut accounts = vec![
        AccountMeta::new(creator, true),
        AccountMeta::new(mission, false),
        AccountMeta::new(allocation, false),
        AccountMeta::new(reputation, false),
        AccountMeta::new_readonly(system_program::id(), false),
    ];
    if let Some(verification) = verification {
        accounts.push(AccountMeta::new_readonly(verification, false));
    }
    mission_ix(
        program_id,
        accounts,
        MissionInstruction::FinalizeAllocation(FinalizeAllocationArgs { successful }),
    )
}

fn refund_mission_ix(
    program_id: Pubkey,
    creator: Pubkey,
    mission: &MissionAddrs,
    creator_ata: Pubkey,
    mint: Pubkey,
    amount: u64,
) -> Instruction {
    mission_ix(
        program_id,
        vec![
            AccountMeta::new(creator, true),
            AccountMeta::new(mission.mission, false),
            AccountMeta::new(creator_ata, false),
            AccountMeta::new(mission.mission_vault_ata, false),
            AccountMeta::new_readonly(mission.vault_authority, false),
            AccountMeta::new_readonly(mint, false),
            AccountMeta::new_readonly(spl_token::id(), false),
        ],
        MissionInstruction::RefundMission(RefundMissionArgs { amount }),
    )
}

fn assert_program_error(result: Result<(), BanksClientError>) {
    match result {
        Ok(_) => panic!("expected transaction failure"),
        Err(BanksClientError::TransactionError(TransactionError::InstructionError(_, _))) => {}
        Err(other) => panic!("unexpected failure: {other:?}"),
    }
}

fn assert_custom_error(result: Result<(), BanksClientError>, expected: MissionError) {
    match result {
        Ok(_) => panic!("expected transaction failure"),
        Err(BanksClientError::TransactionError(TransactionError::InstructionError(
            _,
            InstructionError::Custom(actual),
        ))) => assert_eq!(actual, expected as u32),
        Err(other) => panic!("unexpected failure: {other:?}"),
    }
}

#[tokio::test]
#[serial]
async fn wrong_account_discriminator_is_rejected() {
    let mut harness = Harness::new(DEFAULT_FEE_BPS).await;
    let mut registry_account = harness
        .context
        .banks_client
        .get_account(harness.agent_registry)
        .await
        .unwrap()
        .unwrap();
    registry_account.data[..8].copy_from_slice(&Mission::DISCRIMINATOR);
    let registry_account = AccountSharedData::from(registry_account);
    harness
        .context
        .set_account(&harness.agent_registry, &registry_account);

    let result = harness
        .send_payer(
            &[update_agent_ix(
                harness.program_id,
                harness.context.payer.pubkey(),
                harness.config,
                harness.agent_registry,
                harness.agent.pubkey(),
                harness.agent.pubkey(),
                UpdateAgentArgs {
                    metadata_hash: [21; 32],
                    capability_hash: [22; 32],
                    verifier: harness.verifier.pubkey(),
                    privacy_policy_hash: [23; 32],
                    active: true,
                },
            )],
            &[],
        )
        .await;
    assert_custom_error(result, MissionError::InvalidAccountData);
}

#[tokio::test]
#[serial]
async fn protocol_controls_and_agent_registry_are_enforced() {
    let mut harness = Harness::new(DEFAULT_FEE_BPS).await;
    let bad_mint = harness.create_extra_mint().await;
    let bad_mission = harness.mission_addrs([1; 32], bad_mint.pubkey());

    assert_program_error(
        harness
            .send_payer(
                &[create_mission_ix(
                    harness.program_id,
                    harness.context.payer.pubkey(),
                    harness.config,
                    &bad_mission,
                    bad_mint.pubkey(),
                    CreateMissionArgs {
                        mission_ref: bad_mission.mission_ref,
                        metadata_hash: [1; 32],
                        private_manifest_hash: [2; 32],
                        budget_commitment_hash: [3; 32],
                        verifier: harness.verifier.pubkey(),
                        total_budget: 100_000_000,
                        privacy_mode: PrivacyMode::Hybrid,
                        verification_mode: VerificationMode::Verifier,
                        challenge_window_seconds: 1,
                    },
                )],
                &[],
            )
            .await,
    );

    harness
        .update_protocol(DEFAULT_FEE_BPS, true, false, harness.mint.pubkey())
        .await;
    let paused_mission = harness.mission_addrs([2; 32], harness.mint.pubkey());
    assert_program_error(
        harness
            .send_payer(
                &[create_mission_ix(
                    harness.program_id,
                    harness.context.payer.pubkey(),
                    harness.config,
                    &paused_mission,
                    harness.mint.pubkey(),
                    CreateMissionArgs {
                        mission_ref: paused_mission.mission_ref,
                        metadata_hash: [4; 32],
                        private_manifest_hash: [5; 32],
                        budget_commitment_hash: [6; 32],
                        verifier: harness.verifier.pubkey(),
                        total_budget: 100_000_000,
                        privacy_mode: PrivacyMode::Hybrid,
                        verification_mode: VerificationMode::Verifier,
                        challenge_window_seconds: 1,
                    },
                )],
                &[],
            )
            .await,
    );

    harness
        .update_protocol(DEFAULT_FEE_BPS, false, true, harness.mint.pubkey())
        .await;
    let extra_agent = Keypair::new();
    harness.fund_signer(&extra_agent.pubkey()).await;
    let extra_registry = agent_registry_pda(&harness.program_id, &extra_agent.pubkey());
    assert_program_error(
        harness
            .send_from(
                &extra_agent,
                &[register_agent_ix(
                    harness.program_id,
                    extra_agent.pubkey(),
                    harness.config,
                    extra_registry,
                    extra_agent.pubkey(),
                    RegisterAgentArgs {
                        metadata_hash: [7; 32],
                        capability_hash: [8; 32],
                        verifier: harness.verifier.pubkey(),
                        privacy_policy_hash: [9; 32],
                    },
                )],
                &[],
            )
            .await,
    );

    harness
        .update_protocol(DEFAULT_FEE_BPS, false, false, harness.mint.pubkey())
        .await;
    harness
        .register_agent_for(&extra_agent, extra_agent.pubkey())
        .await;

    let mission = harness.mission_addrs([3; 32], harness.mint.pubkey());
    harness
        .create_mission(&mission, harness.mint.pubkey(), 200_000_000)
        .await;
    harness.fund_mission(&mission, 200_000_000).await;
    harness.activate_mission(&mission).await;

    harness.update_default_agent(false).await;
    let blocked_allocation = harness.allocation_addrs(&mission, [4; 32], [5; 32]);
    assert_program_error(
        harness
            .send_payer(
                &[create_allocation_ix(
                    harness.program_id,
                    harness.context.payer.pubkey(),
                    mission.mission,
                    blocked_allocation.allocation,
                    harness.agent_registry,
                    harness.agent.pubkey(),
                    harness.agent.pubkey(),
                    CreateAllocationArgs {
                        allocation_ref: blocked_allocation.allocation_ref,
                        spend_budget_cap: 50_000_000,
                        payout_cap: 50_000_000,
                        max_per_call: 10_000_000,
                        human_approval_above: 5_000_000,
                        policy_commitment_hash: [10; 32],
                    },
                )],
                &[],
            )
            .await,
    );

    harness.update_default_agent(true).await;
    harness
        .create_default_allocation(
            &mission,
            &blocked_allocation,
            50_000_000,
            50_000_000,
            10_000_000,
            5_000_000,
        )
        .await;

    let config_state: ProtocolConfig = harness.read_program_state(harness.config).await;
    let registry_state: AgentRegistry = harness.read_program_state(harness.agent_registry).await;
    let allocation_state: Allocation = harness
        .read_program_state(blocked_allocation.allocation)
        .await;

    assert_eq!(config_state.allowed_mint, harness.mint.pubkey());
    assert!(!config_state.mission_creation_paused);
    assert!(!config_state.agent_registration_paused);
    assert_eq!(registry_state.status, AgentStatus::Active);
    assert_eq!(allocation_state.policy_commitment_hash, [41; 32]);
}

#[tokio::test]
#[serial]
async fn full_mission_lifecycle_settles_fee_and_refunds_remaining_budget() {
    let mut harness = Harness::new(DEFAULT_FEE_BPS).await;
    let mission = harness.mission_addrs([11; 32], harness.mint.pubkey());
    let addrs = harness.allocation_addrs(&mission, [12; 32], [13; 32]);

    harness
        .create_mission(&mission, harness.mint.pubkey(), 500_000_000)
        .await;
    harness.fund_mission(&mission, 500_000_000).await;
    harness.activate_mission(&mission).await;
    harness.pause_mission(&mission).await;
    harness.activate_mission(&mission).await;
    let resumed_state: Mission = harness.read_program_state(mission.mission).await;
    assert_eq!(resumed_state.status, MissionStatus::Active);
    harness
        .create_default_allocation(
            &mission,
            &addrs,
            100_000_000,
            200_000_000,
            60_000_000,
            20_000_000,
        )
        .await;
    harness
        .upsert_default_provider_policy(&mission, &addrs, 40_000_000, 90_000_000, true)
        .await;
    let pre_request_state: Mission = harness.read_program_state(mission.mission).await;
    assert_eq!(pre_request_state.status, MissionStatus::Active);

    harness
        .send_agent(&[request_spend_ix(
            harness.program_id,
            harness.agent.pubkey(),
            mission.mission,
            addrs.allocation,
            addrs.provider_policy,
            addrs.request,
            RequestSpendArgs {
                request_ref: addrs.request_ref,
                purpose_hash: [14; 32],
                amount: 30_000_000,
                ttl_seconds: 3600,
            },
        )])
        .await
        .unwrap();

    harness
        .send_payer(
            &[approve_spend_ix(
                harness.program_id,
                harness.context.payer.pubkey(),
                mission.mission,
                addrs.allocation,
                addrs.request,
                true,
            )],
            &[],
        )
        .await
        .unwrap();

    harness
        .send_agent(&[execute_spend_ix(
            harness.program_id,
            harness.agent.pubkey(),
            &mission,
            &addrs,
            harness.provider_ata,
            harness.provider.pubkey(),
            harness.mint.pubkey(),
            [15; 32],
            [16; 32],
        )])
        .await
        .unwrap();

    harness
        .send_verifier(&[submit_verification_ix(
            harness.program_id,
            harness.verifier.pubkey(),
            mission.mission,
            mission.verification,
            SubmitVerificationArgs {
                artifact_hash: [17; 32],
                proof_hash: [18; 32],
                output_hash: [19; 32],
                approved: true,
            },
        )])
        .await
        .unwrap();

    assert_program_error(
        harness
            .send_payer(
                &[settle_allocation_ix(
                    harness.program_id,
                    harness.context.payer.pubkey(),
                    harness.config,
                    &mission,
                    &addrs,
                    harness.agent_ata,
                    harness.treasury_ata,
                    harness.mint.pubkey(),
                    150_000_000,
                )],
                &[],
            )
            .await,
    );

    harness.advance_time_by(2).await;

    harness
        .send_payer(
            &[settle_allocation_ix(
                harness.program_id,
                harness.context.payer.pubkey(),
                harness.config,
                &mission,
                &addrs,
                harness.agent_ata,
                harness.treasury_ata,
                harness.mint.pubkey(),
                150_000_000,
            )],
            &[],
        )
        .await
        .unwrap();

    harness
        .send_payer(
            &[finalize_allocation_ix(
                harness.program_id,
                harness.context.payer.pubkey(),
                mission.mission,
                addrs.allocation,
                addrs.reputation,
                Some(mission.verification),
                true,
            )],
            &[],
        )
        .await
        .unwrap();

    harness
        .send_payer(
            &[refund_mission_ix(
                harness.program_id,
                harness.context.payer.pubkey(),
                &mission,
                harness.creator_ata,
                harness.mint.pubkey(),
                320_000_000,
            )],
            &[],
        )
        .await
        .unwrap();

    let mission_state: Mission = harness.read_program_state(mission.mission).await;
    let allocation_state: Allocation = harness.read_program_state(addrs.allocation).await;
    let request_state: SpendRequest = harness.read_program_state(addrs.request).await;
    let verification_state: VerificationRecord =
        harness.read_program_state(mission.verification).await;
    let reputation_state: AgentReputation = harness.read_program_state(addrs.reputation).await;

    assert_eq!(mission_state.status, MissionStatus::Settled);
    assert_eq!(mission_state.spent_amount, 30_000_000);
    assert_eq!(mission_state.settled_amount, 150_000_000);
    assert_eq!(mission_state.refunded_amount, 320_000_000);
    assert_eq!(mission_state.allocated_amount, 0);
    assert_eq!(mission_state.private_manifest_hash, [32; 32]);
    assert_eq!(mission_state.budget_commitment_hash, [33; 32]);
    assert_eq!(allocation_state.status, AllocationStatus::Settled);
    assert_eq!(allocation_state.spend_amount, 30_000_000);
    assert_eq!(allocation_state.payout_amount, 150_000_000);
    assert_eq!(request_state.status, SpendStatus::Executed);
    assert_eq!(verification_state.status, VerificationStatus::Approved);
    assert_eq!(reputation_state.missions_completed, 1);
    assert_eq!(reputation_state.missions_failed, 0);
    assert_eq!(reputation_state.total_earned, 150_000_000);
    assert_eq!(reputation_state.total_tool_spend, 30_000_000);

    assert_eq!(
        harness.get_token_balance(harness.provider_ata).await,
        30_000_000
    );
    assert_eq!(
        harness.get_token_balance(harness.agent_ata).await,
        142_500_000
    );
    assert_eq!(
        harness.get_token_balance(harness.treasury_ata).await,
        7_500_000
    );
    assert_eq!(
        harness.get_token_balance(harness.creator_ata).await,
        820_000_000
    );
    assert_eq!(
        harness.get_token_balance(mission.mission_vault_ata).await,
        0
    );
}

#[tokio::test]
#[serial]
async fn spend_guardrails_block_unapproved_and_expired_requests_and_autoapprove_small_calls() {
    let mut harness = Harness::new(DEFAULT_FEE_BPS).await;
    let mission = harness.mission_addrs([21; 32], harness.mint.pubkey());
    let rejected = harness.allocation_addrs(&mission, [22; 32], [23; 32]);
    let expired = harness.allocation_addrs(&mission, [22; 32], [24; 32]);
    let auto = harness.allocation_addrs(&mission, [22; 32], [25; 32]);

    harness
        .create_mission(&mission, harness.mint.pubkey(), 300_000_000)
        .await;
    harness.fund_mission(&mission, 300_000_000).await;
    harness.activate_mission(&mission).await;
    harness
        .create_default_allocation(&mission, &rejected, 60_000_000, 0, 30_000_000, 20_000_000)
        .await;
    harness
        .upsert_default_provider_policy(&mission, &rejected, 30_000_000, 60_000_000, true)
        .await;

    harness
        .send_agent(&[request_spend_ix(
            harness.program_id,
            harness.agent.pubkey(),
            mission.mission,
            rejected.allocation,
            rejected.provider_policy,
            rejected.request,
            RequestSpendArgs {
                request_ref: rejected.request_ref,
                purpose_hash: [26; 32],
                amount: 25_000_000,
                ttl_seconds: 3600,
            },
        )])
        .await
        .unwrap();

    let rejected_request: SpendRequest = harness.read_program_state(rejected.request).await;
    assert_eq!(rejected_request.status, SpendStatus::Pending);

    assert_program_error(
        harness
            .send_agent(&[execute_spend_ix(
                harness.program_id,
                harness.agent.pubkey(),
                &mission,
                &rejected,
                harness.provider_ata,
                harness.provider.pubkey(),
                harness.mint.pubkey(),
                [27; 32],
                [28; 32],
            )])
            .await,
    );

    harness
        .send_agent(&[request_spend_ix(
            harness.program_id,
            harness.agent.pubkey(),
            mission.mission,
            expired.allocation,
            expired.provider_policy,
            expired.request,
            RequestSpendArgs {
                request_ref: expired.request_ref,
                purpose_hash: [29; 32],
                amount: 25_000_000,
                ttl_seconds: 1,
            },
        )])
        .await
        .unwrap();

    harness
        .send_payer(
            &[approve_spend_ix(
                harness.program_id,
                harness.context.payer.pubkey(),
                mission.mission,
                expired.allocation,
                expired.request,
                false,
            )],
            &[],
        )
        .await
        .unwrap();
    assert_program_error(
        harness
            .send_agent(&[execute_spend_ix(
                harness.program_id,
                harness.agent.pubkey(),
                &mission,
                &expired,
                harness.provider_ata,
                harness.provider.pubkey(),
                harness.mint.pubkey(),
                [30; 32],
                [31; 32],
            )])
            .await,
    );

    harness
        .send_agent(&[request_spend_ix(
            harness.program_id,
            harness.agent.pubkey(),
            mission.mission,
            auto.allocation,
            auto.provider_policy,
            auto.request,
            RequestSpendArgs {
                request_ref: auto.request_ref,
                purpose_hash: [32; 32],
                amount: 25_000_000,
                ttl_seconds: 1,
            },
        )])
        .await
        .unwrap();
    harness
        .send_payer(
            &[approve_spend_ix(
                harness.program_id,
                harness.context.payer.pubkey(),
                mission.mission,
                auto.allocation,
                auto.request,
                true,
            )],
            &[],
        )
        .await
        .unwrap();
    harness.advance_time_by(2).await;
    assert_program_error(
        harness
            .send_agent(&[execute_spend_ix(
                harness.program_id,
                harness.agent.pubkey(),
                &mission,
                &auto,
                harness.provider_ata,
                harness.provider.pubkey(),
                harness.mint.pubkey(),
                [33; 32],
                [34; 32],
            )])
            .await,
    );

    let auto_small = harness.allocation_addrs(&mission, [22; 32], [35; 32]);
    harness
        .send_agent(&[request_spend_ix(
            harness.program_id,
            harness.agent.pubkey(),
            mission.mission,
            auto_small.allocation,
            auto_small.provider_policy,
            auto_small.request,
            RequestSpendArgs {
                request_ref: auto_small.request_ref,
                purpose_hash: [36; 32],
                amount: 10_000_000,
                ttl_seconds: 3600,
            },
        )])
        .await
        .unwrap();
    harness
        .send_agent(&[execute_spend_ix(
            harness.program_id,
            harness.agent.pubkey(),
            &mission,
            &auto_small,
            harness.provider_ata,
            harness.provider.pubkey(),
            harness.mint.pubkey(),
            [37; 32],
            [38; 32],
        )])
        .await
        .unwrap();
    assert_program_error(
        harness
            .send_payer(
                &[finalize_allocation_ix(
                    harness.program_id,
                    harness.context.payer.pubkey(),
                    mission.mission,
                    rejected.allocation,
                    rejected.reputation,
                    None,
                    false,
                )],
                &[],
            )
            .await,
    );
    harness
        .send_verifier(&[submit_verification_ix(
            harness.program_id,
            harness.verifier.pubkey(),
            mission.mission,
            mission.verification,
            SubmitVerificationArgs {
                artifact_hash: [67; 32],
                proof_hash: [68; 32],
                output_hash: [69; 32],
                approved: false,
            },
        )])
        .await
        .unwrap();
    harness
        .send_payer(
            &[finalize_allocation_ix(
                harness.program_id,
                harness.context.payer.pubkey(),
                mission.mission,
                rejected.allocation,
                rejected.reputation,
                Some(mission.verification),
                false,
            )],
            &[],
        )
        .await
        .unwrap();
    harness
        .send_payer(
            &[refund_mission_ix(
                harness.program_id,
                harness.context.payer.pubkey(),
                &mission,
                harness.creator_ata,
                harness.mint.pubkey(),
                290_000_000,
            )],
            &[],
        )
        .await
        .unwrap();

    let mission_state: Mission = harness.read_program_state(mission.mission).await;
    let rejected_state: SpendRequest = harness.read_program_state(expired.request).await;
    let reputation_state: AgentReputation = harness.read_program_state(rejected.reputation).await;

    assert_eq!(mission_state.status, MissionStatus::Cancelled);
    assert_eq!(mission_state.refunded_amount, 290_000_000);
    assert_eq!(mission_state.spent_amount, 10_000_000);
    assert_eq!(mission_state.allocated_amount, 0);
    assert_eq!(rejected_state.status, SpendStatus::Rejected);
    assert_eq!(reputation_state.missions_failed, 1);
    assert_eq!(reputation_state.total_tool_spend, 10_000_000);
    assert_eq!(
        harness.get_token_balance(harness.provider_ata).await,
        10_000_000
    );
}

#[tokio::test]
#[serial]
async fn dispute_upheld_allows_settlement_and_records_dispute_win() {
    let mut harness = Harness::new(DEFAULT_FEE_BPS).await;
    let mission = harness.mission_addrs([41; 32], harness.mint.pubkey());
    let addrs = harness.allocation_addrs(&mission, [42; 32], [43; 32]);
    let dispute = dispute_pda(&harness.program_id, &mission.verification);

    harness
        .create_mission(&mission, harness.mint.pubkey(), 200_000_000)
        .await;
    harness.fund_mission(&mission, 200_000_000).await;
    harness.activate_mission(&mission).await;
    harness
        .create_default_allocation(&mission, &addrs, 0, 100_000_000, 0, 0)
        .await;

    harness
        .send_verifier(&[submit_verification_ix(
            harness.program_id,
            harness.verifier.pubkey(),
            mission.mission,
            mission.verification,
            SubmitVerificationArgs {
                artifact_hash: [44; 32],
                proof_hash: [45; 32],
                output_hash: [46; 32],
                approved: true,
            },
        )])
        .await
        .unwrap();
    harness
        .send_payer(
            &[challenge_verification_ix(
                harness.program_id,
                harness.context.payer.pubkey(),
                mission.mission,
                mission.verification,
                dispute,
                ChallengeVerificationArgs {
                    reason_hash: [47; 32],
                },
            )],
            &[],
        )
        .await
        .unwrap();

    assert_program_error(
        harness
            .send_verifier(&[submit_verification_ix(
                harness.program_id,
                harness.verifier.pubkey(),
                mission.mission,
                mission.verification,
                SubmitVerificationArgs {
                    artifact_hash: [48; 32],
                    proof_hash: [49; 32],
                    output_hash: [50; 32],
                    approved: true,
                },
            )])
            .await,
    );

    assert_program_error(
        harness
            .send_payer(
                &[settle_allocation_ix(
                    harness.program_id,
                    harness.context.payer.pubkey(),
                    harness.config,
                    &mission,
                    &addrs,
                    harness.agent_ata,
                    harness.treasury_ata,
                    harness.mint.pubkey(),
                    100_000_000,
                )],
                &[],
            )
            .await,
    );

    harness
        .send_verifier(&[resolve_dispute_ix(
            harness.program_id,
            harness.verifier.pubkey(),
            mission.mission,
            mission.verification,
            dispute,
            true,
        )])
        .await
        .unwrap();
    harness.advance_time_by(2).await;

    harness
        .send_payer(
            &[settle_allocation_ix(
                harness.program_id,
                harness.context.payer.pubkey(),
                harness.config,
                &mission,
                &addrs,
                harness.agent_ata,
                harness.treasury_ata,
                harness.mint.pubkey(),
                100_000_000,
            )],
            &[],
        )
        .await
        .unwrap();
    harness
        .send_payer(
            &[finalize_allocation_ix(
                harness.program_id,
                harness.context.payer.pubkey(),
                mission.mission,
                addrs.allocation,
                addrs.reputation,
                Some(mission.verification),
                true,
            )],
            &[],
        )
        .await
        .unwrap();
    harness
        .send_payer(
            &[refund_mission_ix(
                harness.program_id,
                harness.context.payer.pubkey(),
                &mission,
                harness.creator_ata,
                harness.mint.pubkey(),
                100_000_000,
            )],
            &[],
        )
        .await
        .unwrap();

    let dispute_state: DisputeRecord = harness.read_program_state(dispute).await;
    let reputation_state: AgentReputation = harness.read_program_state(addrs.reputation).await;
    assert_eq!(dispute_state.status, DisputeStatus::ResolvedUpheld);
    assert_eq!(reputation_state.disputes_won, 1);
    assert_eq!(reputation_state.disputes_lost, 0);
    assert_eq!(
        harness.get_token_balance(harness.agent_ata).await,
        95_000_000
    );
    assert_eq!(
        harness.get_token_balance(harness.treasury_ata).await,
        5_000_000
    );
}

#[tokio::test]
#[serial]
async fn dispute_rejected_cancels_allocation_and_records_dispute_loss() {
    let mut harness = Harness::new(DEFAULT_FEE_BPS).await;
    let mission = harness.mission_addrs([51; 32], harness.mint.pubkey());
    let addrs = harness.allocation_addrs(&mission, [52; 32], [53; 32]);
    let dispute = dispute_pda(&harness.program_id, &mission.verification);

    harness
        .create_mission(&mission, harness.mint.pubkey(), 200_000_000)
        .await;
    harness.fund_mission(&mission, 200_000_000).await;
    harness.activate_mission(&mission).await;
    harness
        .create_default_allocation(&mission, &addrs, 0, 100_000_000, 0, 0)
        .await;
    harness
        .send_verifier(&[submit_verification_ix(
            harness.program_id,
            harness.verifier.pubkey(),
            mission.mission,
            mission.verification,
            SubmitVerificationArgs {
                artifact_hash: [54; 32],
                proof_hash: [55; 32],
                output_hash: [56; 32],
                approved: true,
            },
        )])
        .await
        .unwrap();
    harness
        .send_payer(
            &[challenge_verification_ix(
                harness.program_id,
                harness.context.payer.pubkey(),
                mission.mission,
                mission.verification,
                dispute,
                ChallengeVerificationArgs {
                    reason_hash: [57; 32],
                },
            )],
            &[],
        )
        .await
        .unwrap();
    harness
        .send_verifier(&[resolve_dispute_ix(
            harness.program_id,
            harness.verifier.pubkey(),
            mission.mission,
            mission.verification,
            dispute,
            false,
        )])
        .await
        .unwrap();

    harness
        .send_payer(
            &[finalize_allocation_ix(
                harness.program_id,
                harness.context.payer.pubkey(),
                mission.mission,
                addrs.allocation,
                addrs.reputation,
                Some(mission.verification),
                false,
            )],
            &[],
        )
        .await
        .unwrap();
    harness
        .send_payer(
            &[refund_mission_ix(
                harness.program_id,
                harness.context.payer.pubkey(),
                &mission,
                harness.creator_ata,
                harness.mint.pubkey(),
                200_000_000,
            )],
            &[],
        )
        .await
        .unwrap();

    let verification_state: VerificationRecord =
        harness.read_program_state(mission.verification).await;
    let dispute_state: DisputeRecord = harness.read_program_state(dispute).await;
    let reputation_state: AgentReputation = harness.read_program_state(addrs.reputation).await;
    let allocation_state: Allocation = harness.read_program_state(addrs.allocation).await;

    assert_eq!(verification_state.status, VerificationStatus::Rejected);
    assert_eq!(dispute_state.status, DisputeStatus::ResolvedRejected);
    assert_eq!(allocation_state.status, AllocationStatus::Cancelled);
    assert_eq!(reputation_state.missions_failed, 1);
    assert_eq!(reputation_state.disputes_lost, 1);
}

#[tokio::test]
#[serial]
async fn rejected_verification_can_be_finalized_without_dispute() {
    let mut harness = Harness::new(DEFAULT_FEE_BPS).await;
    let mission = harness.mission_addrs([61; 32], harness.mint.pubkey());
    let addrs = harness.allocation_addrs(&mission, [62; 32], [63; 32]);

    harness
        .create_mission(&mission, harness.mint.pubkey(), 120_000_000)
        .await;
    harness.fund_mission(&mission, 120_000_000).await;
    harness.activate_mission(&mission).await;
    harness
        .create_default_allocation(&mission, &addrs, 0, 60_000_000, 0, 0)
        .await;
    harness
        .send_verifier(&[submit_verification_ix(
            harness.program_id,
            harness.verifier.pubkey(),
            mission.mission,
            mission.verification,
            SubmitVerificationArgs {
                artifact_hash: [64; 32],
                proof_hash: [65; 32],
                output_hash: [66; 32],
                approved: false,
            },
        )])
        .await
        .unwrap();
    harness
        .send_payer(
            &[finalize_allocation_ix(
                harness.program_id,
                harness.context.payer.pubkey(),
                mission.mission,
                addrs.allocation,
                addrs.reputation,
                Some(mission.verification),
                false,
            )],
            &[],
        )
        .await
        .unwrap();
    harness
        .send_payer(
            &[refund_mission_ix(
                harness.program_id,
                harness.context.payer.pubkey(),
                &mission,
                harness.creator_ata,
                harness.mint.pubkey(),
                120_000_000,
            )],
            &[],
        )
        .await
        .unwrap();

    let mission_state: Mission = harness.read_program_state(mission.mission).await;
    let reputation_state: AgentReputation = harness.read_program_state(addrs.reputation).await;
    assert_eq!(mission_state.status, MissionStatus::Cancelled);
    assert_eq!(mission_state.refunded_amount, 120_000_000);
    assert_eq!(reputation_state.missions_failed, 1);
}

#[tokio::test]
#[serial]
async fn cancel_mission_without_allocations_refunds_full_budget() {
    let mut harness = Harness::new(DEFAULT_FEE_BPS).await;
    let mission = harness.mission_addrs([71; 32], harness.mint.pubkey());

    harness
        .create_mission(&mission, harness.mint.pubkey(), 80_000_000)
        .await;
    harness.fund_mission(&mission, 80_000_000).await;
    harness
        .send_payer(
            &[cancel_mission_ix(
                harness.program_id,
                harness.context.payer.pubkey(),
                mission.mission,
            )],
            &[],
        )
        .await
        .unwrap();
    harness
        .send_payer(
            &[refund_mission_ix(
                harness.program_id,
                harness.context.payer.pubkey(),
                &mission,
                harness.creator_ata,
                harness.mint.pubkey(),
                80_000_000,
            )],
            &[],
        )
        .await
        .unwrap();

    let mission_state: Mission = harness.read_program_state(mission.mission).await;
    assert_eq!(mission_state.status, MissionStatus::Cancelled);
    assert_eq!(mission_state.refunded_amount, 80_000_000);
    assert_eq!(
        harness.get_token_balance(harness.creator_ata).await,
        1_000_000_000
    );
}
