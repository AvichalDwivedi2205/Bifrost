import { demoAnalytics } from "@missionmesh/shared";

import { TopBar } from "@/components/topbar";

export default function AnalyticsPage() {
  return (
    <div className="page-shell">
      <TopBar
        title="Analytics & Observability"
        actions={
          <>
            <button className="btn bg">Last 30 days</button>
            <button className="btn bg">Export</button>
          </>
        }
      />
      <div className="page-pad">
        <div className="summary-grid">
          <div className="summary-cell">
            <div className="summary-number lime">{demoAnalytics.completionRate}</div>
            <div className="mono-label">Completion Rate</div>
          </div>
          <div className="summary-cell">
            <div className="summary-number blue">{demoAnalytics.averageDuration}</div>
            <div className="mono-label">Avg Duration</div>
          </div>
          <div className="summary-cell">
            <div className="summary-number amber">{demoAnalytics.averageBudgetUsed}</div>
            <div className="mono-label">Avg USDC/Mission</div>
          </div>
          <div className="summary-cell">
            <div className="summary-number green">{demoAnalytics.verificationPassRate}</div>
            <div className="mono-label">Verify Pass Rate</div>
          </div>
        </div>

        <div className="analytics-grid">
          <div className="card cp">
            <div className="sh-t section-gap">Top Services Used</div>
            {[
              ["simulation.ai", "42 calls · 0.42 avg", 82, "fl"],
              ["chain-intel.io", "38 calls · 0.20 avg", 70, "fb"],
              ["risk-model.ai", "24 calls · 0.35 avg", 48, "fa"],
              ["wallet-screen.sol", "19 calls · 0.15 avg", 34, "fr"],
            ].map(([label, meta, width, tone]) => (
              <div key={label} className="prow">
                <div className="ph">
                  <span>{label}</span>
                  <span>{meta}</span>
                </div>
                <div className="pt">
                  <div className={`pf ${tone}`} style={{ width: `${width}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="card cp">
            <div className="sh-t section-gap">Top Agents by Trust</div>
            <div className="leader-list">
              {[
                ["✓", "VerifyNet", "330 missions · 99% pass", "95"],
                ["⚡", "ExecCore", "211 missions · 97% pass", "91"],
                ["🔍", "ResearchMax", "142 missions · 96% pass", "89"],
              ].map(([icon, label, meta, score]) => (
                <div key={label} className="leader-row">
                  <div className="leader-icon">{icon}</div>
                  <div className="leader-copy">
                    <div className="mission-title">{label}</div>
                    <div className="mission-meta">{meta}</div>
                  </div>
                  <div className="leader-score">{score}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card cp">
          <div className="sh-t section-gap">On-Chain Program Instructions</div>
          <div className="pgrow">
            {[
              ["24", "create_mission"],
              ["142", "authorize_spend"],
              ["142", "create_receipt"],
              ["22", "approve_settlement"],
              ["847", "update_reputation"],
            ].map(([value, label]) => (
              <div key={label} className="pgc">
                <div className="pgn">{value}</div>
                <div className="pgl">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

