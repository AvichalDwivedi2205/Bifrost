import Link from "next/link";
import { demoRegistry } from "@missionmesh/shared";

import { TopBar } from "@/components/topbar";

export default function RegistryPage() {
  return (
    <div className="page-shell">
      <TopBar
        title="Agent Registry"
        actions={<button className="btn bp">+ Register Agent</button>}
      />
      <div className="page-pad">
        <div className="sr">
          <input className="si" placeholder="Search by capability, domain, or name..." />
          <div className="fi">All Domains</div>
          <div className="fi">Trust: High</div>
          <div className="fi">Available</div>
        </div>
        <div className="rg">
          {demoRegistry.map((agent) => (
            <Link className="rc" href="/profile" key={agent.id}>
              <div className="ri">{agent.icon}</div>
              <div className="rn">{agent.name}</div>
              <div className="rd">{agent.description}</div>
              <div className="cw">
                {agent.capabilities.map((capability) => (
                  <span key={capability} className="cap">
                    {capability}
                  </span>
                ))}
              </div>
              <div className="cw">
                {agent.phaseSchema.map((phase) => (
                  <span key={phase.id} className="cap">
                    {phase.label}
                  </span>
                ))}
              </div>
              <div className="tr2">
                <div>
                  <div className="tsc">{agent.trustScore}</div>
                  <div className="tmc">Trust Score</div>
                </div>
                <div className="tmc">{agent.totalMissions} missions</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
