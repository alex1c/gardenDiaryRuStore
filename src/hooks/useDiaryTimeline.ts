/**
 * Hook: diary timeline events with optional filters and photo map.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { DiaryFilterCategory } from '@/src/domain/codes';
import type { GardenEvent, GardenPhoto } from '@/src/domain/types';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { groupEventsByDate } from '@/src/services/eventDisplay';

export type DiaryTimelineState = {
  loading: boolean;
  groups: { date: string; events: GardenEvent[] }[];
  photosByEventId: Map<string, GardenPhoto[]>;
  reload: () => void;
};

export function useDiaryTimeline(
  seasonId: string | null,
  options: {
    category?: DiaryFilterCategory;
    areaId?: string | null;
    plantingId?: string | null;
    limit?: number;
  }
): DiaryTimelineState {
  const { ready, refreshToken, eventRepository, photoRepository } = useDatabase();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<GardenEvent[]>([]);
  const [photosByEventId, setPhotosByEventId] = useState<Map<string, GardenPhoto[]>>(
    new Map()
  );

  const reload = useCallback(() => {
    if (!ready || !eventRepository || !photoRepository || !seasonId) {
      setEvents([]);
      setPhotosByEventId(new Map());
      setLoading(false);
      return;
    }

    const listed = eventRepository.listBySeason(seasonId, {
      category: options.category ?? 'all',
      areaId: options.areaId ?? undefined,
      plantingId: options.plantingId ?? undefined,
      limit: options.limit ?? 200,
    });
    setEvents(listed);

    const photoMap = new Map<string, GardenPhoto[]>();
    for (const event of listed) {
      const photos = photoRepository.listByEvent(event.id);
      if (photos.length > 0) {
        photoMap.set(event.id, photos);
      }
    }
    setPhotosByEventId(photoMap);
    setLoading(false);
  }, [
    ready,
    eventRepository,
    photoRepository,
    seasonId,
    options.category,
    options.areaId,
    options.plantingId,
    options.limit,
  ]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        reload();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [reload, refreshToken]);

  const groups = useMemo(() => groupEventsByDate(events), [events]);

  return { loading, groups, photosByEventId, reload };
}
