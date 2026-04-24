import Link from "next/link";
import { demoMissionRecord } from "@bifrost/shared";

import { TopBar } from "@/components/topbar";

const historyRows = [
  ["Wallet Risk — 7xKp...mQ4R", "MSN-0024", "Risk Analysis", "4", "0.66 USDC", "Running", "Running", "5pQw...Rz1m"],
  ["Token DD — $BONK", "MSN-0023", "Due Diligence", "3", "0.85 USDC", "4m 22s", "Settled", "3rKx...Qq8p"],
  ["Governance — JUP Prop #44", "MSN-0022", "Governance", "3", "0.50 USDC", "6m 10s", "Partial", "9mNz...Hw3k"],
  ["DeFi Screen — Raydium", "MSN-0021", "DeFi", "4", "1.20 USDC", "8m 44s", "Settled", "2jFt...Lm9q"],
];

export default function HistoryPage() {
  return (
    <div className="page-shell">
      <TopBar
        title="Mission History"
        actions={
          <>
            <button className="btn bg">Export CSV</button>
            <Link className="btn bp" href="/create">
              + New Mission
            </Link>
          </>
        }
      />
      <div className="page-pad">
        <div className="summary-grid">
          <div className="summary-cell">
            <div className="summary-number lime">24</div>
            <div className="mono-label">Total Missions</div>
          </div>
          <div className="summary-cell">
            <div className="summary-number green">22</div>
            <div className="mono-label">Settled</div>
          </div>
          <div className="summary-cell">
            <div className="summary-number">$1,240</div>
            <div className="mono-label">Total Settled</div>
          </div>
          <div className="summary-cell">
            <div className="summary-number blue">{demoMissionRecord.budget.spent.toFixed(2)}</div>
            <div className="mono-label">Avg USDC Used</div>
          </div>
        </div>

        <div className="card table-card">
          <table className="ht">
            <thead>
              <tr>
                <th>Mission</th>
                <th>Type</th>
                <th>Agents</th>
                <th>Spent</th>
                <th>Duration</th>
                <th>Outcome</th>
                <th>TX Sig</th>
              </tr>
            </thead>
            <tbody>
              {historyRows.map((row) => (
                <tr key={row[1]}>
                  <td>
                    <div className="mission-title">{row[0]}</div>
                    <div className="mid">{row[1]}</div>
                  </td>
                  <td>{row[2]}</td>
                  <td>{row[3]}</td>
                  <td className="lime">{row[4]}</td>
                  <td>{row[5]}</td>
                  <td>
                    <span className={`pill ${row[6] === "Settled" ? "pg2" : row[6] === "Partial" ? "pa" : "pl"}`}>
                      {row[6]}
                    </span>
                  </td>
                  <td className="lime">{row[7]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

