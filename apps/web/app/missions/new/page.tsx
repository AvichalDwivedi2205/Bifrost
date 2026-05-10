import MissionChat from '../../../components/chat/MissionChat';
import { Shell } from '../../../components/ui/shell';

export default function NewMissionPage() {
  return (
    <Shell
      title="New mission"
      subtitle="Describe what you want shipped — Bifrost lines up agents and asks policy questions before going on-chain."
      padBody={false}
      fillBody
    >
      <MissionChat mode="intake" />
    </Shell>
  );
}
