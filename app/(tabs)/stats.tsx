/**
 * Статистика — Phase 0 stub.
 */

import { PlaceholderPanel } from '@/src/components/ui/PlaceholderPanel';
import { Screen } from '@/src/components/ui/Screen';

export default function StatsScreen() {
  return (
    <Screen scroll>
      <PlaceholderPanel
        title="Статистика"
        description="Урожай и сводки появятся позже. Агрегаты не хранятся в базе — только считаются."
      />
    </Screen>
  );
}
