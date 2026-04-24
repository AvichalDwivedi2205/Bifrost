import Link from "next/link";
import { demoAnalytics, demoMissionRecord } from "@bifrost/shared";

import { TopBar } from "@/components/topbar";

export default function DashboardPage() {
  return (
    <div className="page-shell">
      <TopBar
        title="Dashboard"
        actions={
          <>
            <button className="btn bg">◎ Devnet</button>
            <Link className="btn bp" href="/create">
              + New Mission
            </Link>
          </>
        }
      />

      <div className="page-pad">
        <div className="hero">
          <div className="hero-ey">Solana Frontier Hackathon · 2026</div>
          <h1 className="hero-h">
            Autonomous Agent
            <br />
            <span>Mission OS</span>
          </h1>
          <p className="hero-p">
            Give one mission. Multiple agents execute it. Native Rust programs enforce
            every rule around budget, verification, settlement, and reputation.
          </p>
          <Link className="btn bp hero-btn" href="/create">
            Launch a Mission →
          </Link>
        </div>

        <div className="krow">
          <div className="kpi">
            <div className="kn lime">24</div>
            <div className="kl">Missions Complete</div>
          </div>
          <div className="kpi">
            <div className="kn blue">847</div>
            <div className="kl">Agent Tasks Run</div>
          </div>
          <div className="kpi">
            <div className="kn">{demoAnalytics.totalValueSettled}</div>
            <div className="kl">Total Value Settled</div>
          </div>
          <div className="kpi">
            <div className="kn green">{demoAnalytics.verificationPassRate}</div>
            <div className="kl">Verification Pass Rate</div>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="card cp">
            <div className="stack-head">
              <span className="sh-t">Recent Missions</span>
              <Link href="/history" className="btn bg micro">
                All →
              </Link>
            </div>
            <div className="mission-list">
              {[
                ["Wallet Risk — 7xKp...mQ4R", "2 min ago · 4 agents", "Settled", "pg2"],
                ["Token DD — $BONK", "1h ago · 3 agents", "Settled", "pg2"],
                ["Governance — JUP Prop #44", "3h ago · 3 agents", "Partial", "pa"],
              ].map(([title, meta, status, tone]) => (
                <div key={title} className="mission-row">
                  <div>
                    <div className="mission-title">{title}</div>
                    <div className="mission-meta">{meta}</div>
                  </div>
                  <span className={`pill ${tone}`}>{status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card cp">
            <div className="stack-head">
              <span className="sh-t">On-Chain Activity</span>
              <span className="pill pl">● Devnet</span>
            </div>
            <div className="activity-list">
              {[
                ["⬡", "Mission vault settled", "3rKx...Qq8p"],
                ["◎", "Spend authorized — 0.40 USDC", "9mNz...Hw3k"],
                ["✓", "Verifier signature accepted", "5pQw...Rz1m"],
                ["⊕", "Reputation PDA updated", "2jFt...Lm9q"],
              ].map(([icon, label, tx]) => (
                <div key={tx} className="activity-row">
                  <div className="activity-icon">{icon}</div>
                  <div>
                    <div className="mission-title">{label}</div>
                    <div className="tx">{tx}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="feature-grid">
          <div className="card cp">
            <div className="eyebrow lime">Native Rust Enforcement</div>
            <div className="body-copy">
              Programs are written without Anchor. Every account check, PDA derivation, and
              CPI call is explicit, auditable, and framework-free.
            </div>
          </div>
          <div className="card cp">
            <div className="eyebrow blue">Multi-Agent Mesh</div>
            <div className="body-copy">
              LangGraph drives deterministic mission flow while role-specific agents use
              OpenRouter and Vertex AI for reasoning, research, risk, and verification.
            </div>
          </div>
          <div className="card cp">
            <div className="eyebrow green">Portable Reputation</div>
            <div className="body-copy">
              Trust compounds from verified on-chain history. Reputation deltas are visible
              to users and portable across missions.
            </div>
          </div>
        </div>

        <div className="card cp">
          <div className="stack-head">
            <span className="sh-t">Demo Mission Snapshot</span>
            <Link className="btn bg micro" href="/live">
              Open Live View →
            </Link>
          </div>
          <div className="snapshot-grid">
            <div>
              <div className="mono-label section-gap">Budget</div>
              <div className="snapshot-number">{demoMissionRecord.budget.remaining.toFixed(2)} USDC</div>
              <div className="mission-meta">Remaining of {demoMissionRecord.budget.totalBudget.toFixed(2)}</div>
            </div>
            <div>
              <div className="mono-label section-gap">Verification</div>
              <div className="snapshot-number">{demoMissionRecord.verificationChecks.length}</div>
              <div className="mission-meta">checks tracked in live mission panel</div>
            </div>
            <div>
              <div className="mono-label section-gap">Receipts</div>
              <div className="snapshot-number">{demoMissionRecord.receipts.length}</div>
              <div className="mission-meta">on-chain spend receipts surfaced in UI</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

