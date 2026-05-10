import MissionChat from '../../../components/chat/MissionChat';
import { Shell } from '../../../components/ui/shell';

interface MissionPageProps {
  params: Promise<{ missionId: string }>;
}

export default async function MissionPage({ params }: MissionPageProps) {
  const { missionId } = await params;
  return (
    <Shell
      title="Mission cockpit"
      subtitle={`Live thread · ${missionId}`}
      padBody={false}
      fillBody
    >
      <MissionChat mode="live" missionId={missionId} />
    </Shell>
  );
}
