/**
 * Дневник — Phase 0 stub.
 */

import { PlaceholderPanel } from '@/src/components/ui/PlaceholderPanel';
import { Screen } from '@/src/components/ui/Screen';

export default function DiaryScreen() {
  return (
    <Screen scroll>
      <PlaceholderPanel
        title="Дневник"
        description="Здесь появится история работ и событий. Реализация — в Phase 4."
      />
    </Screen>
  );
}
