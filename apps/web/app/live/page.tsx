import { LiveMissionView } from "@/components/live-mission-view";
import { TopBar } from "@/components/topbar";

export default async function LivePage({
  searchParams,
}: {
  searchParams: Promise<{ missionId?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="page-shell">
      <TopBar
        title={
          <span className="live-title">
            Live Execution <span className="pill pl">● Running</span>
          </span>
        }
        actions={
          <>
            <button className="btn bg">⏸ Pause</button>
            <button className="btn bk">⬛ Stop</button>
          </>
        }
      />
      <div className="page-pad tight">
        <LiveMissionView missionId={params.missionId} />
      </div>
    </div>
  );
}

