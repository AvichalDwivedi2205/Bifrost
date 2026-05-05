export interface Agent {
  id: string;
  name: string;
  role: string;
  color: string;
  desc: string;
  trust: number;
  missions: number;
  tags: string[];
  phases: string[];
  wallet: string;
  status: string;
}

export interface Mission {
  id: string;
  title: string;
  template: string;
  status: string;
  urgency: string;
  mode: string;
  verify: string;
  spent: number;
  budget: number;
  agents: string[];
  started: string;
  duration: string;
  tx: string;
}

export const AGENTS: Agent[] = [
  { id: 'news-01', name: 'Helios News', role: 'news', color: 'oklch(0.78 0.14 75)',
    desc: 'Real-time public signal synthesis across 2.4k feeds.', trust: 94, missions: 812,
    tags: ['news', 'synthesis', 'timeline'], phases: ['plan timeline', 'gather headlines', 'synthesize signal'],
    wallet: 'HEL1oS…9xKp', status: 'active' },
  { id: 'mkt-01', name: 'Orion Market', role: 'market', color: 'oklch(0.76 0.16 245)',
    desc: 'Orderflow scanner for Polymarket and on-chain venues.', trust: 91, missions: 644,
    tags: ['market', 'orderflow', 'polymarket'], phases: ['map contracts', 'scan orderflow', 'rank markets'],
    wallet: 'OR1on…2mQa', status: 'active' },
  { id: 'skp-01', name: 'Verity Skeptic', role: 'skeptic', color: 'oklch(0.70 0.18 295)',
    desc: 'Adversarial thesis challenger with suspicion scoring.', trust: 89, missions: 518,
    tags: ['skeptic', 'adversarial', 'red-team'], phases: ['replay timing', 'challenge thesis', 'score suspicion'],
    wallet: 'VER1t…7hNd', status: 'active' },
  { id: 'exe-01', name: 'Atlas Execution', role: 'execution', color: 'oklch(0.80 0.14 195)',
    desc: 'Packages recommendations, verdicts, confidence artifacts.', trust: 96, missions: 921,
    tags: ['execution', 'artifact', 'verdict'], phases: ['draft verdict', 'package artifact'],
    wallet: 'ATLs…4cVx', status: 'active' },
  { id: 'ver-01', name: 'Aegis Verifier', role: 'verifier', color: 'oklch(0.72 0.14 155)',
    desc: 'On-chain verification proofs and settlement anchor.', trust: 98, missions: 1124,
    tags: ['verify', 'proof', 'settle'], phases: ['audit approvals', 'check artifacts', 'settle onchain'],
    wallet: 'AEG1s…3rTy', status: 'active' },
  { id: 'res-01', name: 'Cipher Research', role: 'research', color: 'oklch(0.72 0.13 250)',
    desc: 'Wallet context and counterparty exposure analysis.', trust: 87, missions: 302,
    tags: ['research', 'wallet', 'exposure'], phases: ['collect context', 'map counterparties', 'summarize risk'],
    wallet: 'C1ph3…0jKw', status: 'active' },
  { id: 'rsk-01', name: 'Sentinel Risk', role: 'risk', color: 'oklch(0.65 0.20 25)',
    desc: 'Dynamic risk scoring + simulation trigger.', trust: 85, missions: 267,
    tags: ['risk', 'simulation', 'score'], phases: ['compute risk', 'trigger sim'],
    wallet: 'S3nt1…5bQw', status: 'probation' },
  { id: 'crd-01', name: 'Nexus Coordinator', role: 'coordinator', color: 'oklch(0.78 0.16 180)',
    desc: 'Breaks missions into deterministic task graphs.', trust: 93, missions: 712,
    tags: ['coordinator', 'planner', 'task graph'], phases: ['decompose', 'sequence', 'dispatch'],
    wallet: 'NEXu5…1fGh', status: 'active' },
];

export const MISSIONS: Mission[] = [
  { id: 'msn-7a4f', title: 'Trump Polymarket Edge Scan', template: 'Trump Polymarket Demo',
    status: 'running', urgency: 'high', mode: 'guarded autonomy', verify: 'hybrid',
    spent: 4.82, budget: 12, agents: ['news-01', 'mkt-01', 'skp-01', 'exe-01', 'ver-01'],
    started: '2m 14s ago', duration: '—', tx: '5Kv9…qP2x' },
  { id: 'msn-6b1c', title: 'DePIN Weekly Signal Brief', template: 'Signal Hunt',
    status: 'settled', urgency: 'medium', mode: 'full autonomy', verify: 'agent',
    spent: 8.14, budget: 10, agents: ['news-01', 'mkt-01', 'exe-01', 'ver-01'],
    started: '3h ago', duration: '27m 04s', tx: '3Nm2…vRj8' },
  { id: 'msn-5a0d', title: 'Ethena Counterparty Audit', template: 'Event Trade Research',
    status: 'settled', urgency: 'critical', mode: 'manual assist', verify: 'human',
    spent: 14.92, budget: 20, agents: ['res-01', 'rsk-01', 'skp-01', 'ver-01'],
    started: '6h ago', duration: '1h 12m', tx: '9Kx4…tL1m' },
  { id: 'msn-4c2e', title: 'NFT Floor Monitoring', template: 'Monitoring',
    status: 'settled', urgency: 'low', mode: 'guarded autonomy', verify: 'proof',
    spent: 2.30, budget: 4, agents: ['mkt-01', 'ver-01'],
    started: '1d ago', duration: '4h 22m', tx: '2Bd7…yW4e' },
  { id: 'msn-3e9a', title: 'Memecoin Wash-Trade Probe', template: 'Custom',
    status: 'failed', urgency: 'high', mode: 'full autonomy', verify: 'hybrid',
    spent: 5.04, budget: 6, agents: ['mkt-01', 'res-01', 'skp-01'],
    started: '2d ago', duration: '52m 18s', tx: '7Gh3…kX9o' },
  { id: 'msn-2f8b', title: 'Stablecoin Depeg Playbook', template: 'Event Trade Research',
    status: 'settled', urgency: 'critical', mode: 'manual assist', verify: 'human',
    spent: 11.40, budget: 15, agents: ['news-01', 'mkt-01', 'rsk-01', 'exe-01', 'ver-01'],
    started: '3d ago', duration: '1h 48m', tx: '4Rf1…mZ6a' },
];

export const STATUS_TONE: Record<string, string> = {
  running: 'pending', settled: 'ok', failed: 'danger', pending: 'warn',
  verifying: 'pending', selection_pending: 'warn', queued: 'default', probation: 'warn',
};

export function fmtUsdc(n: number) { return `${n.toFixed(2)} USDC`; }
export function fmtPct(n: number) { return `${n.toFixed(0)}%`; }
