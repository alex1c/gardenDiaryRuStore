/**
 * Create garden area — full form with optional dimensions.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';

import { AreaForm, type AreaFormValues } from '@/src/components/area/AreaForm';
import { Screen } from '@/src/components/ui/Screen';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';

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
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll keyboardShouldPersistTaps="handled">
      <AreaForm
        submitLabel="Сохранить"
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        saving={saving}
      />
    </Screen>
  );
}
