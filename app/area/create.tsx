/**
 * Create garden area — full form with optional dimensions.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';

import { AreaForm, type AreaFormValues } from '@/src/components/area/AreaForm';
import { Screen } from '@/src/components/ui/Screen';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { markMeaningfulActionCompleted } from '@/src/services/ads/adSession';
import { trackAnalyticsEvent } from '@/src/services/analytics/analytics';
import { ANALYTICS_EVENTS } from '@/src/services/analytics/events';

export default function CreateAreaScreen() {
  const router = useRouter();
  const { areaRepository, bumpRefresh } = useDatabase();
  const { garden } = useGardenSnapshot();
  const [saving, setSaving] = useState(false);

  const handleSubmit = (values: AreaFormValues) => {
    if (!areaRepository || !garden) {
      return;
    }

    setSaving(true);
    try {
      areaRepository.create({
        gardenId: garden.id,
        name: values.name,
        type: values.type,
        length: values.length,
        width: values.width,
        notes: values.notes,
      });
      bumpRefresh();
      trackAnalyticsEvent(ANALYTICS_EVENTS.AREA_CREATED, {
        area_type: values.type,
      });
      markMeaningfulActionCompleted();
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll keyboardAvoiding keyboardShouldPersistTaps="handled">
      <AreaForm
        submitLabel="Сохранить"
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        saving={saving}
      />
    </Screen>
  );
}
