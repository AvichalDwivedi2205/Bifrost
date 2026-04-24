use std::{env, error::Error, path::PathBuf, thread::sleep, time::Duration};

use borsh::BorshDeserialize;
use bifrost_program::{
    instruction::{
        ApproveSpendArgs, ChallengeVerificationArgs, CreateAllocationArgs, CreateMissionArgs,
        ExecuteSpendArgs, FinalizeAllocationArgs, FundMissionArgs, InitializeProtocolArgs,
        MissionInstruction, RefundMissionArgs, RegisterAgentArgs, RequestSpendArgs,
        ResolveDisputeArgs, SettleAllocationArgs, SubmitVerificationArgs, UpsertProviderPolicyArgs,
    },
    state::{
        AgentReputation, Allocation, AllocationStatus, DisputeRecord, DisputeStatus, Mission,
        MissionStatus, PrivacyMode, SpendRequest, SpendStatus, VerificationMode,
        VerificationRecord, VerificationStatus,
    },
};
use solana_client::rpc_client::RpcClient;
use solana_program::{
    instruction::{AccountMeta, Instruction},
    program_pack::Pack,
    pubkey::Pubkey,
    system_program,
};
use solana_sdk::{
    commitment_config::CommitmentConfig,
    signature::{read_keypair_file, Keypair, Signature, Signer},
    system_instruction,
    transaction::Transaction,
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
const DEFAULT_RPC_URL: &str = "http://127.0.0.1:8899";

type Result<T> = std::result::Result<T, Box<dyn Error>>;

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

struct SmokeConfig {
    rpc_url: String,
    payer_path: PathBuf,
    program_keypair_path: PathBuf,
}

#[derive(Clone, Copy, Default)]
struct ReputationSnapshot {
    missions_completed: u64,
    missions_failed: u64,
    total_earned: u64,
    total_tool_spend: u64,
    disputes_won: u64,
}

struct SurfpoolHarness {
    rpc: RpcClient,
    program_id: Pubkey,
    payer: Keypair,
    mint: Keypair,
    verifier: Keypair,
    agent: Keypair,
    provider: Keypair,
    treasury: Keypair,
    config: Pubkey,
    agent_registry: Pubkey,
    creator_ata: Pubkey,
    agent_ata: Pubkey,
    provider_ata: Pubkey,
    treasury_ata: Pubkey,
}

impl SurfpoolHarness {
    fn new(config: &SmokeConfig) -> Result<Self> {
        let rpc =
            RpcClient::new_with_commitment(config.rpc_url.clone(), CommitmentConfig::confirmed());
        let payer = read_keypair_file(&config.payer_path)?;
        let program_keypair = read_keypair_file(&config.program_keypair_path)?;
        let mint = Keypair::new();
        let verifier = Keypair::new();
        let agent = Keypair::new();
        let provider = Keypair::new();
        let treasury = Keypair::new();
        let program_id = program_keypair.pubkey();
        let config_pda = protocol_config_pda(&program_id);
        let agent_registry = agent_registry_pda(&program_id, &agent.pubkey());

        let creator_ata = get_associated_token_address_with_program_id(
            &payer.pubkey(),
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

        let harness = Self {
            rpc,
            program_id,
            payer,
            mint,
            verifier,
            agent,
            provider,
            treasury,
            config: config_pda,
            agent_registry,
            creator_ata,
            agent_ata,
            provider_ata,
            treasury_ata,
        };

        harness.fund_signer(&harness.verifier.pubkey())?;
        harness.fund_signer(&harness.agent.pubkey())?;
        harness.fund_signer(&harness.provider.pubkey())?;
        harness.fund_signer(&harness.treasury.pubkey())?;
        harness.create_main_mint_and_seed_accounts()?;
        harness.initialize_protocol()?;
        harness.register_default_agent()?;
        Ok(harness)
    }

    fn send(
        &self,
        payer: &Keypair,
        instructions: &[Instruction],
        extra_signers: &[&Keypair],
    ) -> Result<Signature> {
        let mut signers = vec![payer];
        signers.extend_from_slice(extra_signers);
        let latest_blockhash = self.rpc.get_latest_blockhash()?;
        let tx = Transaction::new_signed_with_payer(
            instructions,
            Some(&payer.pubkey()),
            &signers,
            latest_blockhash,
        );
        Ok(self.rpc.send_and_confirm_transaction(&tx)?)
    }

    fn send_payer(
        &self,
        instructions: &[Instruction],
        extra_signers: &[&Keypair],
    ) -> Result<Signature> {
        self.send(&self.payer, instructions, extra_signers)
    }

    fn send_agent(&self, instructions: &[Instruction]) -> Result<Signature> {
        self.send(&self.agent, instructions, &[])
    }

    fn send_verifier(&self, instructions: &[Instruction]) -> Result<Signature> {
        self.send(&self.verifier, instructions, &[])
    }

    fn fund_signer(&self, recipient: &Pubkey) -> Result<()> {
        self.send_payer(
            &[system_instruction::transfer(
                &self.payer.pubkey(),
                recipient,
                2_000_000_000,
            )],
            &[],
        )?;
        Ok(())
    }

    fn create_main_mint_and_seed_accounts(&self) -> Result<()> {
        let rent = self.rpc.get_minimum_balance_for_rent_exemption(Mint::LEN)?;
        self.send_payer(
            &[
                system_instruction::create_account(
                    &self.payer.pubkey(),
                    &self.mint.pubkey(),
                    rent,
                    Mint::LEN as u64,
                    &spl_token::id(),
                ),
                token_instruction::initialize_mint(
                    &spl_token::id(),
                    &self.mint.pubkey(),
                    &self.payer.pubkey(),
                    None,
                    DECIMALS,
                )?,
            ],
            &[&self.mint],
        )?;

        for owner in [
            self.payer.pubkey(),
            self.agent.pubkey(),
            self.provider.pubkey(),
            self.treasury.pubkey(),
        ] {
            self.send_payer(
                &[create_associated_token_account(
                    &self.payer.pubkey(),
                    &owner,
                    &self.mint.pubkey(),
                    &spl_token::id(),
                )],
                &[],
            )?;
        }

        self.send_payer(
            &[token_instruction::mint_to(
                &spl_token::id(),
                &self.mint.pubkey(),
                &self.creator_ata,
                &self.payer.pubkey(),
                &[],
                1_000_000_000,
            )?],
            &[],
        )?;
        Ok(())
    }

    fn initialize_protocol(&self) -> Result<()> {
        self.send_payer(
            &[initialize_protocol_ix(
                self.program_id,
                self.payer.pubkey(),
                self.config,
                InitializeProtocolArgs {
                    treasury: self.treasury.pubkey(),
                    allowed_mint: self.mint.pubkey(),
                    protocol_fee_bps: DEFAULT_FEE_BPS,
                    mission_creation_paused: false,
                    agent_registration_paused: false,
                },
            )],
            &[],
        )?;
        Ok(())
    }

    fn register_default_agent(&self) -> Result<()> {
        self.send_agent(&[register_agent_ix(
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
        )])?;
        Ok(())
    }

    fn mission_addrs(&self, mission_ref: [u8; 32]) -> MissionAddrs {
        let mission = mission_pda(&self.program_id, &self.payer.pubkey(), &mission_ref);
        let vault_authority = vault_authority_pda(&self.program_id, &mission);
        let mission_vault_ata = get_associated_token_address_with_program_id(
            &vault_authority,
            &self.mint.pubkey(),
            &spl_token::id(),
        );
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

    fn read_state<T: BorshDeserialize>(&self, address: Pubkey) -> Result<T> {
        let account = self.rpc.get_account(&address)?;
        let mut slice = account.data.as_slice();
        Ok(T::deserialize(&mut slice)?)
    }

    fn reputation_snapshot(&self, address: Pubkey) -> Result<ReputationSnapshot> {
        match self.rpc.get_account(&address) {
            Ok(account) => {
                let mut slice = account.data.as_slice();
                let reputation = AgentReputation::deserialize(&mut slice)?;
                Ok(ReputationSnapshot {
                    missions_completed: reputation.missions_completed,
                    missions_failed: reputation.missions_failed,
                    total_earned: reputation.total_earned,
                    total_tool_spend: reputation.total_tool_spend,
                    disputes_won: reputation.disputes_won,
                })
            }
            Err(_) => Ok(ReputationSnapshot::default()),
        }
    }

    fn token_balance(&self, address: Pubkey) -> Result<u64> {
        let account = self.rpc.get_account(&address)?;
        Ok(TokenAccount::unpack(&account.data)?.amount)
    }

    fn wait_for_challenge_window(&self) {
        sleep(Duration::from_secs(2));
    }
}

fn main() -> Result<()> {
    let config = smoke_config();
    let harness = SurfpoolHarness::new(&config)?;

    println!("Running Surfpool smoke tests against {}", config.rpc_url);
    run_full_lifecycle(&harness)?;
    run_spend_guardrails(&harness)?;
    run_dispute_flow(&harness)?;
    run_cancel_refund(&harness)?;
    println!("Surfpool smoke tests passed.");
    Ok(())
}

fn smoke_config() -> SmokeConfig {
    let home = env::var("HOME").unwrap_or_else(|_| ".".to_string());
    SmokeConfig {
        rpc_url: env::var("BIFROST_RPC_URL").unwrap_or_else(|_| DEFAULT_RPC_URL.to_string()),
        payer_path: env::var("BIFROST_PAYER")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from(home).join(".config/solana/id.json")),
        program_keypair_path: env::var("BIFROST_PROGRAM_KEYPAIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("target/deploy/bifrost_program-keypair.json")
            }),
    }
}

fn run_full_lifecycle(harness: &SurfpoolHarness) -> Result<()> {
    println!("Scenario: full mission lifecycle");
    let mission = harness.mission_addrs([1; 32]);
    let addrs = harness.allocation_addrs(&mission, [2; 32], [3; 32]);
    let reputation_before = harness.reputation_snapshot(addrs.reputation)?;

    harness.send_payer(
        &[create_mission_ix(
            harness.program_id,
            harness.payer.pubkey(),
            harness.config,
            &mission,
            harness.mint.pubkey(),
            CreateMissionArgs {
                mission_ref: mission.mission_ref,
                metadata_hash: [31; 32],
                private_manifest_hash: [32; 32],
                budget_commitment_hash: [33; 32],
                verifier: harness.verifier.pubkey(),
                total_budget: 500_000_000,
                privacy_mode: PrivacyMode::Hybrid,
                verification_mode: VerificationMode::Verifier,
                challenge_window_seconds: 1,
            },
        )],
        &[],
    )?;
    harness.send_payer(
        &[fund_mission_ix(
            harness.program_id,
            harness.payer.pubkey(),
            &mission,
            harness.creator_ata,
            harness.mint.pubkey(),
            500_000_000,
        )],
        &[],
    )?;
    harness.send_payer(
        &[activate_mission_ix(
            harness.program_id,
            harness.payer.pubkey(),
            mission.mission,
        )],
        &[],
    )?;
    harness.send_payer(
        &[pause_mission_ix(
            harness.program_id,
            harness.payer.pubkey(),
            mission.mission,
        )],
        &[],
    )?;
    harness.send_payer(
        &[activate_mission_ix(
            harness.program_id,
            harness.payer.pubkey(),
            mission.mission,
        )],
        &[],
    )?;
    harness.send_payer(
        &[create_allocation_ix(
            harness.program_id,
            harness.payer.pubkey(),
            mission.mission,
            addrs.allocation,
            harness.agent_registry,
            harness.agent.pubkey(),
            harness.agent.pubkey(),
            CreateAllocationArgs {
                allocation_ref: addrs.allocation_ref,
                spend_budget_cap: 100_000_000,
                payout_cap: 200_000_000,
                max_per_call: 60_000_000,
                human_approval_above: 20_000_000,
                policy_commitment_hash: [41; 32],
            },
        )],
        &[],
    )?;
    harness.send_payer(
        &[upsert_provider_policy_ix(
            harness.program_id,
            harness.payer.pubkey(),
            mission.mission,
            addrs.allocation,
            addrs.provider_policy,
            harness.provider.pubkey(),
            UpsertProviderPolicyArgs {
                per_call_cap: 40_000_000,
                total_cap: 90_000_000,
                active: true,
            },
        )],
        &[],
    )?;
    harness.send_agent(&[request_spend_ix(
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
    )])?;
    harness.send_payer(
        &[approve_spend_ix(
            harness.program_id,
            harness.payer.pubkey(),
            mission.mission,
            addrs.allocation,
            addrs.request,
            true,
        )],
        &[],
    )?;
    harness.send_agent(&[execute_spend_ix(
        harness.program_id,
        harness.agent.pubkey(),
        &mission,
        &addrs,
        harness.provider_ata,
        harness.provider.pubkey(),
        harness.mint.pubkey(),
        [15; 32],
        [16; 32],
    )])?;
    harness.send_verifier(&[submit_verification_ix(
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
    )])?;
    harness.wait_for_challenge_window();
    harness.send_payer(
        &[settle_allocation_ix(
            harness.program_id,
            harness.payer.pubkey(),
            harness.config,
            &mission,
            &addrs,
            harness.agent_ata,
            harness.treasury_ata,
            harness.mint.pubkey(),
            150_000_000,
        )],
        &[],
    )?;
    harness.send_payer(
        &[finalize_allocation_ix(
            harness.program_id,
            harness.payer.pubkey(),
            mission.mission,
            addrs.allocation,
            addrs.reputation,
            Some(mission.verification),
            true,
        )],
        &[],
    )?;
    harness.send_payer(
        &[refund_mission_ix(
            harness.program_id,
            harness.payer.pubkey(),
            &mission,
            harness.creator_ata,
            harness.mint.pubkey(),
            320_000_000,
        )],
        &[],
    )?;

    let mission_state: Mission = harness.read_state(mission.mission)?;
    let allocation_state: Allocation = harness.read_state(addrs.allocation)?;
    let request_state: SpendRequest = harness.read_state(addrs.request)?;
    let verification_state: VerificationRecord = harness.read_state(mission.verification)?;
    let reputation_state: AgentReputation = harness.read_state(addrs.reputation)?;

    assert_eq!(mission_state.status, MissionStatus::Settled);
    assert_eq!(allocation_state.status, AllocationStatus::Settled);
    assert_eq!(request_state.status, SpendStatus::Executed);
    assert_eq!(verification_state.status, VerificationStatus::Approved);
    assert_eq!(
        reputation_state.missions_completed,
        reputation_before.missions_completed + 1
    );
    assert_eq!(
        reputation_state.total_tool_spend,
        reputation_before.total_tool_spend + 30_000_000
    );
    assert_eq!(
        reputation_state.total_earned,
        reputation_before.total_earned + 150_000_000
    );
    assert_eq!(harness.token_balance(harness.provider_ata)?, 30_000_000);
    assert_eq!(harness.token_balance(harness.agent_ata)?, 142_500_000);
    assert_eq!(harness.token_balance(harness.treasury_ata)?, 7_500_000);
    Ok(())
}

fn run_spend_guardrails(harness: &SurfpoolHarness) -> Result<()> {
    println!("Scenario: spend guardrails");
    let mission = harness.mission_addrs([11; 32]);
    let rejected = harness.allocation_addrs(&mission, [12; 32], [13; 32]);
    let expired = harness.allocation_addrs(&mission, [12; 32], [14; 32]);
    let auto = harness.allocation_addrs(&mission, [12; 32], [15; 32]);
    let reputation_before = harness.reputation_snapshot(rejected.reputation)?;

    harness.send_payer(
        &[create_mission_ix(
            harness.program_id,
            harness.payer.pubkey(),
            harness.config,
            &mission,
            harness.mint.pubkey(),
            CreateMissionArgs {
                mission_ref: mission.mission_ref,
                metadata_hash: [51; 32],
                private_manifest_hash: [52; 32],
                budget_commitment_hash: [53; 32],
                verifier: harness.verifier.pubkey(),
                total_budget: 300_000_000,
                privacy_mode: PrivacyMode::Hybrid,
                verification_mode: VerificationMode::Verifier,
                challenge_window_seconds: 1,
            },
        )],
        &[],
    )?;
    harness.send_payer(
        &[fund_mission_ix(
            harness.program_id,
            harness.payer.pubkey(),
            &mission,
            harness.creator_ata,
            harness.mint.pubkey(),
            300_000_000,
        )],
        &[],
    )?;
    harness.send_payer(
        &[activate_mission_ix(
            harness.program_id,
            harness.payer.pubkey(),
            mission.mission,
        )],
        &[],
    )?;
    harness.send_payer(
        &[create_allocation_ix(
            harness.program_id,
            harness.payer.pubkey(),
            mission.mission,
            rejected.allocation,
            harness.agent_registry,
            harness.agent.pubkey(),
            harness.agent.pubkey(),
            CreateAllocationArgs {
                allocation_ref: rejected.allocation_ref,
                spend_budget_cap: 60_000_000,
                payout_cap: 0,
                max_per_call: 30_000_000,
                human_approval_above: 20_000_000,
                policy_commitment_hash: [54; 32],
            },
        )],
        &[],
    )?;
    harness.send_payer(
        &[upsert_provider_policy_ix(
            harness.program_id,
            harness.payer.pubkey(),
            mission.mission,
            rejected.allocation,
            rejected.provider_policy,
            harness.provider.pubkey(),
            UpsertProviderPolicyArgs {
                per_call_cap: 30_000_000,
                total_cap: 60_000_000,
                active: true,
            },
        )],
        &[],
    )?;
    harness.send_agent(&[request_spend_ix(
        harness.program_id,
        harness.agent.pubkey(),
        mission.mission,
        rejected.allocation,
        rejected.provider_policy,
        rejected.request,
        RequestSpendArgs {
            request_ref: rejected.request_ref,
            purpose_hash: [55; 32],
            amount: 25_000_000,
            ttl_seconds: 3600,
        },
    )])?;
    assert!(harness
        .send_agent(&[execute_spend_ix(
            harness.program_id,
            harness.agent.pubkey(),
            &mission,
            &rejected,
            harness.provider_ata,
            harness.provider.pubkey(),
            harness.mint.pubkey(),
            [56; 32],
            [57; 32],
        )])
        .is_err());
    harness.send_agent(&[request_spend_ix(
        harness.program_id,
        harness.agent.pubkey(),
        mission.mission,
        expired.allocation,
        expired.provider_policy,
        expired.request,
        RequestSpendArgs {
            request_ref: expired.request_ref,
            purpose_hash: [58; 32],
            amount: 25_000_000,
            ttl_seconds: 1,
        },
    )])?;
    harness.send_payer(
        &[approve_spend_ix(
            harness.program_id,
            harness.payer.pubkey(),
            mission.mission,
            expired.allocation,
            expired.request,
            false,
        )],
        &[],
    )?;
    assert!(harness
        .send_agent(&[execute_spend_ix(
            harness.program_id,
            harness.agent.pubkey(),
            &mission,
            &expired,
            harness.provider_ata,
            harness.provider.pubkey(),
            harness.mint.pubkey(),
            [59; 32],
            [60; 32],
        )])
        .is_err());
    harness.send_agent(&[request_spend_ix(
        harness.program_id,
        harness.agent.pubkey(),
        mission.mission,
        auto.allocation,
        auto.provider_policy,
        auto.request,
        RequestSpendArgs {
            request_ref: auto.request_ref,
            purpose_hash: [61; 32],
            amount: 10_000_000,
            ttl_seconds: 3600,
        },
    )])?;
    harness.send_agent(&[execute_spend_ix(
        harness.program_id,
        harness.agent.pubkey(),
        &mission,
        &auto,
        harness.provider_ata,
        harness.provider.pubkey(),
        harness.mint.pubkey(),
        [62; 32],
        [63; 32],
    )])?;
    harness.send_verifier(&[submit_verification_ix(
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
    )])?;
    harness.send_payer(
        &[finalize_allocation_ix(
            harness.program_id,
            harness.payer.pubkey(),
            mission.mission,
            rejected.allocation,
            rejected.reputation,
            Some(mission.verification),
            false,
        )],
        &[],
    )?;
    harness.send_payer(
        &[refund_mission_ix(
            harness.program_id,
            harness.payer.pubkey(),
            &mission,
            harness.creator_ata,
            harness.mint.pubkey(),
            290_000_000,
        )],
        &[],
    )?;

    let mission_state: Mission = harness.read_state(mission.mission)?;
    let verification_state: VerificationRecord = harness.read_state(mission.verification)?;
    let reputation_state: AgentReputation = harness.read_state(rejected.reputation)?;
    assert_eq!(mission_state.status, MissionStatus::Cancelled);
    assert_eq!(verification_state.status, VerificationStatus::Rejected);
    assert_eq!(
        reputation_state.total_tool_spend,
        reputation_before.total_tool_spend + 10_000_000
    );
    assert_eq!(
        reputation_state.missions_failed,
        reputation_before.missions_failed + 1
    );
    Ok(())
}

fn run_dispute_flow(harness: &SurfpoolHarness) -> Result<()> {
    println!("Scenario: dispute flow");
    let mission = harness.mission_addrs([21; 32]);
    let addrs = harness.allocation_addrs(&mission, [22; 32], [23; 32]);
    let dispute = dispute_pda(&harness.program_id, &mission.verification);
    let reputation_before = harness.reputation_snapshot(addrs.reputation)?;

    harness.send_payer(
        &[create_mission_ix(
            harness.program_id,
            harness.payer.pubkey(),
            harness.config,
            &mission,
            harness.mint.pubkey(),
            CreateMissionArgs {
                mission_ref: mission.mission_ref,
                metadata_hash: [71; 32],
                private_manifest_hash: [72; 32],
                budget_commitment_hash: [73; 32],
                verifier: harness.verifier.pubkey(),
                total_budget: 200_000_000,
                privacy_mode: PrivacyMode::Hybrid,
                verification_mode: VerificationMode::Verifier,
                challenge_window_seconds: 1,
            },
        )],
        &[],
    )?;
    harness.send_payer(
        &[fund_mission_ix(
            harness.program_id,
            harness.payer.pubkey(),
            &mission,
            harness.creator_ata,
            harness.mint.pubkey(),
            200_000_000,
        )],
        &[],
    )?;
    harness.send_payer(
        &[activate_mission_ix(
            harness.program_id,
            harness.payer.pubkey(),
            mission.mission,
        )],
        &[],
    )?;
    harness.send_payer(
        &[create_allocation_ix(
            harness.program_id,
            harness.payer.pubkey(),
            mission.mission,
            addrs.allocation,
            harness.agent_registry,
            harness.agent.pubkey(),
            harness.agent.pubkey(),
            CreateAllocationArgs {
                allocation_ref: addrs.allocation_ref,
                spend_budget_cap: 0,
                payout_cap: 100_000_000,
                max_per_call: 0,
                human_approval_above: 0,
                policy_commitment_hash: [74; 32],
            },
        )],
        &[],
    )?;
    harness.send_verifier(&[submit_verification_ix(
        harness.program_id,
        harness.verifier.pubkey(),
        mission.mission,
        mission.verification,
        SubmitVerificationArgs {
            artifact_hash: [75; 32],
            proof_hash: [76; 32],
            output_hash: [77; 32],
            approved: true,
        },
    )])?;
    harness.send_payer(
        &[challenge_verification_ix(
            harness.program_id,
            harness.payer.pubkey(),
            mission.mission,
            mission.verification,
            dispute,
            ChallengeVerificationArgs {
                reason_hash: [78; 32],
            },
        )],
        &[],
    )?;
    assert!(harness
        .send_payer(
            &[settle_allocation_ix(
                harness.program_id,
                harness.payer.pubkey(),
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
        .is_err());
    harness.send_verifier(&[resolve_dispute_ix(
        harness.program_id,
        harness.verifier.pubkey(),
        mission.mission,
        mission.verification,
        dispute,
        true,
    )])?;
    harness.wait_for_challenge_window();
    harness.send_payer(
        &[settle_allocation_ix(
            harness.program_id,
            harness.payer.pubkey(),
            harness.config,
            &mission,
            &addrs,
            harness.agent_ata,
            harness.treasury_ata,
            harness.mint.pubkey(),
            100_000_000,
        )],
        &[],
    )?;
    harness.send_payer(
        &[finalize_allocation_ix(
            harness.program_id,
            harness.payer.pubkey(),
            mission.mission,
            addrs.allocation,
            addrs.reputation,
            Some(mission.verification),
            true,
        )],
        &[],
    )?;
    harness.send_payer(
        &[refund_mission_ix(
            harness.program_id,
            harness.payer.pubkey(),
            &mission,
            harness.creator_ata,
            harness.mint.pubkey(),
            100_000_000,
        )],
        &[],
    )?;

    let dispute_state: DisputeRecord = harness.read_state(dispute)?;
    let reputation_state: AgentReputation = harness.read_state(addrs.reputation)?;
    assert_eq!(dispute_state.status, DisputeStatus::ResolvedUpheld);
    assert_eq!(
        reputation_state.disputes_won,
        reputation_before.disputes_won + 1
    );
    assert_eq!(
        reputation_state.missions_completed,
        reputation_before.missions_completed + 1
    );
    assert_eq!(
        reputation_state.total_earned,
        reputation_before.total_earned + 100_000_000
    );
    Ok(())
}

fn run_cancel_refund(harness: &SurfpoolHarness) -> Result<()> {
    println!("Scenario: cancel and refund");
    let mission = harness.mission_addrs([31; 32]);
    harness.send_payer(
        &[create_mission_ix(
            harness.program_id,
            harness.payer.pubkey(),
            harness.config,
            &mission,
            harness.mint.pubkey(),
            CreateMissionArgs {
                mission_ref: mission.mission_ref,
                metadata_hash: [81; 32],
                private_manifest_hash: [82; 32],
                budget_commitment_hash: [83; 32],
                verifier: harness.verifier.pubkey(),
                total_budget: 80_000_000,
                privacy_mode: PrivacyMode::Hybrid,
                verification_mode: VerificationMode::Verifier,
                challenge_window_seconds: 1,
            },
        )],
        &[],
    )?;
    harness.send_payer(
        &[fund_mission_ix(
            harness.program_id,
            harness.payer.pubkey(),
            &mission,
            harness.creator_ata,
            harness.mint.pubkey(),
            80_000_000,
        )],
        &[],
    )?;
    harness.send_payer(
        &[cancel_mission_ix(
            harness.program_id,
            harness.payer.pubkey(),
            mission.mission,
        )],
        &[],
    )?;
    harness.send_payer(
        &[refund_mission_ix(
            harness.program_id,
            harness.payer.pubkey(),
            &mission,
            harness.creator_ata,
            harness.mint.pubkey(),
            80_000_000,
        )],
        &[],
    )?;

    let mission_state: Mission = harness.read_state(mission.mission)?;
    assert_eq!(mission_state.status, MissionStatus::Cancelled);
    assert_eq!(harness.token_balance(mission.mission_vault_ata)?, 0);
    Ok(())
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
