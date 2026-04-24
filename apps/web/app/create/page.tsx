import { MissionCreateForm } from "@/components/mission-create-form";
import { TopBar } from "@/components/topbar";

export default function CreateMissionPage() {
  return (
    <div className="page-shell">
      <TopBar
        title="New Mission"
        actions={
          <>
            <a className="btn bg" href="/">
              ← Back
            </a>
          </>
        }
      />
      <div className="page-pad">
        <MissionCreateForm />
      </div>
    </div>
  );
}

