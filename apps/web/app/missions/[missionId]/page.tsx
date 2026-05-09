import MissionChat from '../../../components/chat/MissionChat';

interface MissionPageProps {
  params: Promise<{ missionId: string }>;
}

export default async function MissionPage({ params }: MissionPageProps) {
  const { missionId } = await params;
  return <MissionChat mode="live" missionId={missionId} />;
}
