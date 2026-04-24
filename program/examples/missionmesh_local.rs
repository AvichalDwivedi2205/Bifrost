use std::{
    env,
    error::Error,
    fs,
    path::{Path, PathBuf},
    thread::sleep,
    time::Duration,
};

use borsh::BorshDeserialize;
use missionmesh_program::{
    instruction::{
        ApproveSpendArgs, CreateAllocationArgs, CreateMissionArgs, ExecuteSpendArgs,
        FinalizeAllocationArgs, FundMissionArgs, InitializeProtocolArgs, MissionInstruction,
        RefundMissionArgs, RegisterAgentArgs, RequestSpendArgs, SettleAllocationArgs,
        SubmitVerificationArgs, UpsertProviderPolicyArgs,
    },
    state::{
        AgentRegistry, Allocation, AllocationStatus, Mission, PrivacyMode, ProtocolConfig,
        ProviderPolicy, SpendRequest, SpendStatus, VerificationMode, VerificationRecord,
        VerificationStatus,
    },
};
use solana_client::rpc_client::RpcClient;
use solana_program::{
    hash::hash,
    instruction::{AccountMeta, Instruction},
    program_pack::Pack,
    pubkey::Pubkey,
    system_program,
};
use solana_sdk::{
    commitment_config::CommitmentConfig,
    signature::{read_keypair_file, write_keypair_file, Keypair, Signature, Signer},
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
const DEFAULT_PAYOUT_CAP: u64 = 150_000;
const DEFAULT_SETTLEMENT_PAYOUT: u64 = 120_000;

type Result<T> = std::result::Result<T, Box<dyn Error>>;

#[derive(Clone)]
struct DriverConfig {
    rpc_url: String,
    payer_path: PathBuf,
    program_keypair_path: PathBuf,
    state_dir: PathBuf,
}

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

struct LocalHarness {
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

fn main() -> Result<()> {
    let config = driver_config();
    let command = env::args().nth(1).unwrap_or_default();
    if command.is_empty() {
        return Err("usage: cargo run --example missionmesh_local -- <command> [args]".into());
    }

    let harness = LocalHarness::new(&config)?;
    harness.ensure_bootstrap()?;

    match command.as_str() {
        "create-mission" => {
            let mission_id = required_arg("--mission-id")?;
            let total_budget = parse_u64_arg("--total-budget")?;
            let addrs = harness.create_mission_if_needed(&mission_id, total_budget)?;
            println!("MISSION_PDA={}", addrs.mission);
            println!("VERIFICATION_PDA={}", addrs.verification);
            println!("VAULT_ATA={}", addrs.mission_vault_ata);
            println!("TX=create_or_reused");
        }
        "prepare-mission" => {
            let mission_id = required_arg("--mission-id")?;
            let spend_budget_cap = parse_u64_arg("--spend-budget-cap")?;
            let payout_cap = optional_u64_arg("--payout-cap").unwrap_or(DEFAULT_PAYOUT_CAP);
            let max_per_call = parse_u64_arg("--max-per-call")?;
            harness.prepare_allocation_if_needed(
                &mission_id,
                spend_budget_cap,
                payout_cap,
                max_per_call,
            )?;
            println!("TX=allocation_ready");
        }
        "spend" => {
            let mission_id = required_arg("--mission-id")?;
            let amount = parse_u64_arg("--amount")?;
            let purpose = required_arg("--purpose")?;
            let tx = harness.execute_spend(&mission_id, amount, &purpose)?;
            println!("TX={tx}");
            println!("RECEIPT=receipt_{}", short_hash(&purpose));
        }
        "verify" => {
            let mission_id = required_arg("--mission-id")?;
            let proof_hash = required_arg("--proof-hash")?;
            let tx = harness.submit_verification(&mission_id, &proof_hash)?;
            println!("TX={tx}");
        }
        "settle" => {
            let mission_id = required_arg("--mission-id")?;
            let tx = harness.settle_and_refund(&mission_id)?;
            println!("TX={tx}");
        }
        "debug-mission" => {
            let mission_id = required_arg("--mission-id")?;
            harness.debug_mission(&mission_id)?;
            println!("TX=debug");
        }
        _ => {
            return Err(format!("unknown command: {command}").into());
        }
    }

    Ok(())
}

fn driver_config() -> DriverConfig {
    let home = env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    DriverConfig {
        rpc_url: env::var("MISSIONMESH_RPC_URL").unwrap_or_else(|_| DEFAULT_RPC_URL.to_string()),
        payer_path: env::var("MISSIONMESH_PAYER")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from(home).join(".config/solana/id.json")),
        program_keypair_path: env::var("MISSIONMESH_PROGRAM_KEYPAIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| manifest_dir.join("target/deploy/missionmesh_program-keypair.json")),
        state_dir: manifest_dir.join(".missionmesh-local"),
    }
}

impl LocalHarness {
    fn new(config: &DriverConfig) -> Result<Self> {
        fs::create_dir_all(&config.state_dir)?;
        let rpc =
            RpcClient::new_with_commitment(config.rpc_url.clone(), CommitmentConfig::confirmed());
        let payer = read_keypair_file(&config.payer_path)?;
        let program_keypair = read_keypair_file(&config.program_keypair_path)?;
        let mint = load_or_create_keypair(&config.state_dir.join("mint.json"))?;
        let verifier = load_or_create_keypair(&config.state_dir.join("verifier.json"))?;
        let agent = load_or_create_keypair(&config.state_dir.join("executor-agent.json"))?;
        let provider = load_or_create_keypair(&config.state_dir.join("provider.json"))?;
        let treasury = load_or_create_keypair(&config.state_dir.join("treasury.json"))?;
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

        Ok(Self {
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
        })
    }

    fn ensure_bootstrap(&self) -> Result<()> {
        self.fund_signer_if_needed(&self.verifier.pubkey())?;
        self.fund_signer_if_needed(&self.agent.pubkey())?;
        self.fund_signer_if_needed(&self.provider.pubkey())?;
        self.fund_signer_if_needed(&self.treasury.pubkey())?;
        self.create_mint_if_needed()?;
        self.ensure_ata(&self.payer.pubkey(), self.creator_ata)?;
        self.ensure_ata(&self.agent.pubkey(), self.agent_ata)?;
        self.ensure_ata(&self.provider.pubkey(), self.provider_ata)?;
        self.ensure_ata(&self.treasury.pubkey(), self.treasury_ata)?;
        self.mint_creator_balance_if_low()?;
        self.initialize_protocol_if_needed()?;
        self.register_agent_if_needed()?;
        Ok(())
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

    fn fund_signer_if_needed(&self, recipient: &Pubkey) -> Result<()> {
        let balance = self.rpc.get_balance(recipient).unwrap_or(0);
        if balance >= 1_000_000_000 {
            return Ok(());
        }
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

    fn create_mint_if_needed(&self) -> Result<()> {
        if self.rpc.get_account(&self.mint.pubkey()).is_ok() {
            return Ok(());
        }

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
        Ok(())
    }

    fn ensure_ata(&self, owner: &Pubkey, ata: Pubkey) -> Result<()> {
        if self.rpc.get_account(&ata).is_ok() {
            return Ok(());
        }

        self.send_payer(
            &[create_associated_token_account(
                &self.payer.pubkey(),
                owner,
                &self.mint.pubkey(),
                &spl_token::id(),
            )],
            &[],
        )?;
        Ok(())
    }

    fn mint_creator_balance_if_low(&self) -> Result<()> {
        let current = self.token_balance(self.creator_ata).unwrap_or(0);
        if current >= 5_000_000 {
            return Ok(());
        }

        self.send_payer(
            &[token_instruction::mint_to(
                &spl_token::id(),
                &self.mint.pubkey(),
                &self.creator_ata,
                &self.payer.pubkey(),
                &[],
                10_000_000_000,
            )?],
            &[],
        )?;
        Ok(())
    }

    fn initialize_protocol_if_needed(&self) -> Result<()> {
        if self.rpc.get_account(&self.config).is_ok() {
            let _config: ProtocolConfig = self.read_state(self.config)?;
            return Ok(());
        }

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

    fn register_agent_if_needed(&self) -> Result<()> {
        if self.rpc.get_account(&self.agent_registry).is_ok() {
            let _registry: AgentRegistry = self.read_state(self.agent_registry)?;
            return Ok(());
        }

        self.send_agent(&[register_agent_ix(
            self.program_id,
            self.agent.pubkey(),
            self.config,
            self.agent_registry,
            self.agent.pubkey(),
            RegisterAgentArgs {
                metadata_hash: hash(b"missionmesh-local-agent").to_bytes(),
                capability_hash: hash(b"missionmesh-spend-runtime").to_bytes(),
                verifier: self.verifier.pubkey(),
                privacy_policy_hash: hash(b"missionmesh-local-privacy").to_bytes(),
            },
        )])?;
        Ok(())
    }

    fn create_mission_if_needed(&self, mission_id: &str, total_budget: u64) -> Result<MissionAddrs> {
        let addrs = self.mission_addrs(mission_id);
        if self.rpc.get_account(&addrs.mission).is_ok() {
            return Ok(addrs);
        }

        self.send_payer(
            &[create_mission_ix(
                self.program_id,
                self.payer.pubkey(),
                self.config,
                &addrs,
                self.mint.pubkey(),
                CreateMissionArgs {
                    mission_ref: addrs.mission_ref,
                    metadata_hash: hash(format!("mission:{mission_id}").as_bytes()).to_bytes(),
                    private_manifest_hash: hash(format!("manifest:{mission_id}").as_bytes()).to_bytes(),
                    budget_commitment_hash: hash(format!("budget:{mission_id}:{total_budget}").as_bytes()).to_bytes(),
                    verifier: self.verifier.pubkey(),
                    total_budget,
                    privacy_mode: PrivacyMode::Hybrid,
                    verification_mode: VerificationMode::Verifier,
                    challenge_window_seconds: 1,
                },
            )],
            &[],
        )?;
        self.send_payer(
            &[fund_mission_ix(
                self.program_id,
                self.payer.pubkey(),
                &addrs,
                self.creator_ata,
                self.mint.pubkey(),
                total_budget,
            )],
            &[],
        )?;
        self.send_payer(
            &[activate_mission_ix(
                self.program_id,
                self.payer.pubkey(),
                addrs.mission,
            )],
            &[],
        )?;
        Ok(addrs)
    }

    fn prepare_allocation_if_needed(
        &self,
        mission_id: &str,
        spend_budget_cap: u64,
        payout_cap: u64,
        max_per_call: u64,
    ) -> Result<()> {
        let mission = self.mission_addrs(mission_id);
        let addrs = self.allocation_addrs(mission_id, "bootstrap");

        if self.rpc.get_account(&addrs.allocation).is_err() {
            self.send_payer(
                &[create_allocation_ix(
                    self.program_id,
                    self.payer.pubkey(),
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
                        human_approval_above: 0,
                        policy_commitment_hash: hash(
                            format!("allocation:{mission_id}:{spend_budget_cap}:{payout_cap}:{max_per_call}")
                                .as_bytes(),
                        )
                        .to_bytes(),
                    },
                )],
                &[],
            )?;
        } else {
            let _allocation: Allocation = self.read_state(addrs.allocation)?;
        }

        if self.rpc.get_account(&addrs.provider_policy).is_err() {
            self.send_payer(
                &[upsert_provider_policy_ix(
                    self.program_id,
                    self.payer.pubkey(),
                    mission.mission,
                    addrs.allocation,
                    addrs.provider_policy,
                    self.provider.pubkey(),
                    UpsertProviderPolicyArgs {
                        per_call_cap: max_per_call,
                        total_cap: spend_budget_cap,
                        active: true,
                    },
                )],
                &[],
            )?;
        } else {
            let _policy: ProviderPolicy = self.read_state(addrs.provider_policy)?;
        }

        Ok(())
    }

    fn execute_spend(&self, mission_id: &str, amount: u64, purpose: &str) -> Result<String> {
        let mission = self.mission_addrs(mission_id);
        let addrs = self.allocation_addrs(mission_id, purpose);
        if self.rpc.get_account(&addrs.allocation).is_err() {
            return Err("allocation not prepared; call prepare-mission first".into());
        }

        if self.rpc.get_account(&addrs.request).is_err() {
            self.send_agent(&[request_spend_ix(
                self.program_id,
                self.agent.pubkey(),
                mission.mission,
                addrs.allocation,
                addrs.provider_policy,
                addrs.request,
                RequestSpendArgs {
                    request_ref: addrs.request_ref,
                    purpose_hash: hash(purpose.as_bytes()).to_bytes(),
                    amount,
                    ttl_seconds: 3600,
                },
            )])?;
        }

        let request_state: SpendRequest = self.read_state(addrs.request)?;
        if request_state.status == SpendStatus::Pending {
            self.send_payer(
                &[approve_spend_ix(
                    self.program_id,
                    self.payer.pubkey(),
                    mission.mission,
                    addrs.allocation,
                    addrs.request,
                    true,
                )],
                &[],
            )?;
        }

        if self.rpc.get_account(&addrs.receipt).is_ok() {
            return Ok("existing_receipt".to_string());
        }

        let signature = self.send_agent(&[execute_spend_ix(
            self.program_id,
            self.agent.pubkey(),
            &mission,
            &addrs,
            self.provider_ata,
            self.provider.pubkey(),
            self.mint.pubkey(),
            hash(format!("memo:{purpose}").as_bytes()).to_bytes(),
            hash(format!("txref:{purpose}").as_bytes()).to_bytes(),
        )])?;
        Ok(signature.to_string())
    }

    fn submit_verification(&self, mission_id: &str, proof_hash: &str) -> Result<String> {
        let mission = self.mission_addrs(mission_id);
        let signature = self.send_verifier(&[submit_verification_ix(
            self.program_id,
            self.verifier.pubkey(),
            mission.mission,
            mission.verification,
            SubmitVerificationArgs {
                artifact_hash: hash(format!("artifact:{mission_id}").as_bytes()).to_bytes(),
                proof_hash: hash(proof_hash.as_bytes()).to_bytes(),
                output_hash: hash(format!("output:{mission_id}:{proof_hash}").as_bytes()).to_bytes(),
                approved: true,
            },
        )])?;
        Ok(signature.to_string())
    }

    fn settle_and_refund(&self, mission_id: &str) -> Result<String> {
        let mission = self.mission_addrs(mission_id);
        let addrs = self.allocation_addrs(mission_id, "bootstrap");
        if self.rpc.get_account(&addrs.allocation).is_err() {
            return Err("allocation not prepared; call prepare-mission first".into());
        }

        let verification: VerificationRecord = self.read_state(mission.verification)?;
        if verification.status != VerificationStatus::Approved {
            return Err("verification must be approved before settlement".into());
        }

        sleep(Duration::from_secs(2));

        let allocation: Allocation = self.read_state(addrs.allocation)?;
        if allocation.status == AllocationStatus::Active {
            self.send_payer(
                &[settle_allocation_ix(
                    self.program_id,
                    self.payer.pubkey(),
                    self.config,
                    &mission,
                    &addrs,
                    self.agent_ata,
                    self.treasury_ata,
                    self.mint.pubkey(),
                    DEFAULT_SETTLEMENT_PAYOUT.min(allocation.payout_cap),
                )],
                &[],
            )?;
            self.send_payer(
                &[finalize_allocation_ix(
                    self.program_id,
                    self.payer.pubkey(),
                    mission.mission,
                    addrs.allocation,
                    addrs.reputation,
                    Some(mission.verification),
                    true,
                )],
                &[],
            )?;
        }

        let refund_amount = self.token_balance(mission.mission_vault_ata)?;
        let refund_sig = if refund_amount > 0 {
            self.send_payer(
                &[refund_mission_ix(
                    self.program_id,
                    self.payer.pubkey(),
                    &mission,
                    self.creator_ata,
                    self.mint.pubkey(),
                    refund_amount,
                )],
                &[],
            )?
        } else {
            Signature::default()
        };

        Ok(refund_sig.to_string())
    }

    fn debug_mission(&self, mission_id: &str) -> Result<()> {
        let mission_addrs = self.mission_addrs(mission_id);
        let allocation_addrs = self.allocation_addrs(mission_id, "bootstrap");
        let mission: Mission = self.read_state(mission_addrs.mission)?;
        let allocation: Allocation = self.read_state(allocation_addrs.allocation)?;
        let verification: VerificationRecord = self.read_state(mission_addrs.verification)?;
        let mission_vault = TokenAccount::unpack(&self.rpc.get_account(&mission_addrs.mission_vault_ata)?.data)?;
        let creator_ata = TokenAccount::unpack(&self.rpc.get_account(&self.creator_ata)?.data)?;
        let agent_ata = TokenAccount::unpack(&self.rpc.get_account(&self.agent_ata)?.data)?;
        let treasury_ata = TokenAccount::unpack(&self.rpc.get_account(&self.treasury_ata)?.data)?;
        let expected_verification = verification_pda(&self.program_id, &mission_addrs.mission);
        let expected_vault_authority = vault_authority_pda(&self.program_id, &mission_addrs.mission);
        let expected_vault_ata = get_associated_token_address_with_program_id(
            &expected_vault_authority,
            &self.mint.pubkey(),
            &spl_token::id(),
        );

        println!("DEBUG_MISSION={}", mission_addrs.mission);
        println!("DEBUG_MISSION_CREATOR={}", mission.creator);
        println!("DEBUG_MISSION_MINT={}", mission.mint);
        println!("DEBUG_MISSION_VERIFIER={}", mission.verifier);
        println!("DEBUG_MISSION_VAULT_BUMP={}", mission.vault_authority_bump);
        println!("DEBUG_MISSION_STATUS={:?}", mission.status);
        println!("DEBUG_ALLOCATION_STATUS={:?}", allocation.status);
        println!("DEBUG_ALLOCATION_PAYOUT_WALLET={}", allocation.payout_wallet);
        println!("DEBUG_VERIFICATION_ACCOUNT={}", mission_addrs.verification);
        println!("DEBUG_VERIFICATION_MISSION={}", verification.mission);
        println!("DEBUG_VERIFICATION_STATUS={:?}", verification.status);
        println!("DEBUG_EXPECTED_VERIFICATION={}", expected_verification);
        println!("DEBUG_VAULT_AUTHORITY={}", mission_addrs.vault_authority);
        println!("DEBUG_EXPECTED_VAULT_AUTHORITY={}", expected_vault_authority);
        println!("DEBUG_MISSION_VAULT_ATA={}", mission_addrs.mission_vault_ata);
        println!("DEBUG_EXPECTED_VAULT_ATA={}", expected_vault_ata);
        println!("DEBUG_MISSION_VAULT_OWNER={}", mission_vault.owner);
        println!("DEBUG_MISSION_VAULT_MINT={}", mission_vault.mint);
        println!("DEBUG_MISSION_VAULT_AMOUNT={}", mission_vault.amount);
        println!("DEBUG_CREATOR_ATA_OWNER={}", creator_ata.owner);
        println!("DEBUG_CREATOR_ATA_MINT={}", creator_ata.mint);
        println!("DEBUG_AGENT_ATA_OWNER={}", agent_ata.owner);
        println!("DEBUG_AGENT_ATA_MINT={}", agent_ata.mint);
        println!("DEBUG_TREASURY_ATA_OWNER={}", treasury_ata.owner);
        println!("DEBUG_TREASURY_ATA_MINT={}", treasury_ata.mint);

        Ok(())
    }

    fn mission_addrs(&self, mission_id: &str) -> MissionAddrs {
        let mission_ref = hash(format!("mission-ref:{mission_id}").as_bytes()).to_bytes();
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

    fn allocation_addrs(&self, mission_id: &str, request_key: &str) -> AllocationAddrs {
        let mission = self.mission_addrs(mission_id);
        let allocation_ref = hash(format!("allocation-ref:{mission_id}").as_bytes()).to_bytes();
        let request_ref = hash(format!("request-ref:{mission_id}:{request_key}").as_bytes()).to_bytes();
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

    fn token_balance(&self, address: Pubkey) -> Result<u64> {
        let account = self.rpc.get_account(&address)?;
        Ok(TokenAccount::unpack(&account.data)?.amount)
    }
}

fn load_or_create_keypair(path: &Path) -> Result<Keypair> {
    if path.exists() {
        return Ok(read_keypair_file(path)?);
    }

    let keypair = Keypair::new();
    write_keypair_file(&keypair, path)?;
    Ok(keypair)
}

fn required_arg(flag: &str) -> Result<String> {
    let mut args = env::args().skip(2);
    while let Some(current) = args.next() {
        if current == flag {
            return args
                .next()
                .ok_or_else(|| format!("missing value for {flag}").into());
        }
    }
    Err(format!("missing required flag {flag}").into())
}

fn parse_u64_arg(flag: &str) -> Result<u64> {
    Ok(required_arg(flag)?.parse::<u64>()?)
}

fn optional_u64_arg(flag: &str) -> Option<u64> {
    required_arg(flag).ok()?.parse::<u64>().ok()
}

fn short_hash(value: &str) -> String {
    hash(value.as_bytes())
        .to_string()
        .chars()
        .take(8)
        .collect()
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
        &[b"allocation", mission.as_ref(), agent.as_ref(), allocation_ref],
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

fn settle_allocation_ix(
    program_id: Pubkey,
    creator: Pubkey,
    config: Pubkey,
    mission: &MissionAddrs,
    addrs: &AllocationAddrs,
    payout_token_account: Pubkey,
    treasury_token_account: Pubkey,
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
            AccountMeta::new(payout_token_account, false),
            AccountMeta::new(treasury_token_account, false),
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
    success: bool,
) -> Instruction {
    let mut accounts = vec![
        AccountMeta::new(creator, true),
        AccountMeta::new(mission, false),
        AccountMeta::new(allocation, false),
        AccountMeta::new(reputation, false),
        AccountMeta::new_readonly(system_program::id(), false),
    ];
    if let Some(verification_account) = verification {
        accounts.push(AccountMeta::new_readonly(verification_account, false));
    }
    mission_ix(
        program_id,
        accounts,
        MissionInstruction::FinalizeAllocation(FinalizeAllocationArgs {
            successful: success && verification.is_some(),
        }),
    )
}

fn refund_mission_ix(
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
            AccountMeta::new_readonly(addrs.vault_authority, false),
            AccountMeta::new_readonly(mint, false),
            AccountMeta::new_readonly(spl_token::id(), false),
        ],
        MissionInstruction::RefundMission(RefundMissionArgs { amount }),
    )
}
