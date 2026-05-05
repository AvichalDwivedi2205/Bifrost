import type { AgentProfile } from "@bifrost/shared";
import { demoRegistry } from "@bifrost/shared";

import { TopBar } from "@/components/topbar";

const profile =
  demoRegistry.find((agent) => agent.role === "news") ??
  ({
    id: "fallback-news",
    slug: "fallback-news",
    name: "Trump News Agent",
    role: "news",
    icon: "📰",
    description: "Fallback profile",
    trustScore: 89,
    wallet: "6PaH...nX9q",
    payoutWallet: "6PaH...nX9q",
    verifierWallet: "8RpL...2Qx7",
    active: true,
    totalMissions: 142,
    capabilities: ["headline-triage", "synthesis"],
    verifierCompatible: true,
    supportedServices: ["headline-feed.ai"],
    executionMode: "builtin",
    phaseSchema: [],
  } satisfies AgentProfile);

const reputationHistory = [
  ["MSN-0023 — Token DD", "+2", "89→91"],
  ["MSN-0020 — Launch Monitor", "+1", "88→89"],
  ["MSN-0018 — Wallet Risk", "−1", "89→88"],
  ["MSN-0015 — DeFi Screen", "+2", "87→89"],
];

export default function ProfilePage() {
  return (
    <div className="page-shell">
      <TopBar
        title="Agent Profile"
        actions={
          <>
            <a className="btn bg" href="/registry">
              ← Registry
            </a>
            <button className="btn bp">Assign to Mission</button>
          </>
        }
      />
      <div className="page-pad">
        <div className="ptop">
          <div className="pico">{profile.icon}</div>
          <div className="profile-copy">
            <div className="pn">{profile.name}</div>
            <div className="pw">{profile.wallet} · Reputation PDA on-chain</div>
            <div className="tag-row">
              <span className="pill pl">● Active</span>
              <span className="pill pb">Verifier compat.</span>
            </div>
          </div>
          <div className="pkpis">
            <div className="pk">
              <div className="pkn lime">{profile.totalMissions}</div>
              <div className="pkl">Missions</div>
            </div>
            <div className="pk">
              <div className="pkn green">96%</div>
              <div className="pkl">Pass Rate</div>
            </div>
            <div className="pk">
              <div className="pkn blue">0.22</div>
              <div className="pkl">Avg Spend</div>
            </div>
            <div className="pk">
              <div className="pkn">{profile.trustScore}</div>
              <div className="pkl">Trust</div>
            </div>
          </div>
        </div>

        <div className="profile-grid">
          <div>
            <div className="sh-t section-gap">Role-Specific Trust</div>
            <div className="rsc">
              {[
                ["Research", "94", "lime"],
                ["Planning", "71", "blue"],
                ["Execution", "62", "amber"],
                ["Verify", "88", "green"],
              ].map(([label, score, tone]) => (
                <div key={label} className="rsca">
                  <div className={`rsn ${tone}`}>{score}</div>
                  <div className="rsl">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="sh-t section-gap">Reputation History</div>
            <div className="card cp">
              {reputationHistory.map(([label, delta = "0", range = "0→0"]) => (
                <div key={label} className="rerow">
                  <span className="soft">{label}</span>
                  <div>
                    <span className={delta.startsWith("+") ? "dp" : "dn"}>{delta}</span>
                    <span className="dr">{range}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
