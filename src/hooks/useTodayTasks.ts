/**
 * Hook: loads Today-screen task buckets for the active season.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { GardenTask } from '@/src/domain/types';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { toLocalDateString } from '@/src/utils/localDate';

export type TodayTasksSnapshot = {
  loading: boolean;
  today: string;
  overdue: GardenTask[];
  todayTasks: GardenTask[];
  completedToday: GardenTask[];
  upcoming: GardenTask[];
  upcomingByDate: Map<string, GardenTask[]>;
  reload: () => void;
};

export function useTodayTasks(): TodayTasksSnapshot {
  const { activeSeason } = useGardenSnapshot();
  const { ready, refreshToken, taskRepository } = useDatabase();
  const [loading, setLoading] = useState(true);
  const [overdue, setOverdue] = useState<GardenTask[]>([]);
  const [todayTasks, setTodayTasks] = useState<GardenTask[]>([]);
  const [completedToday, setCompletedToday] = useState<GardenTask[]>([]);
  const [upcoming, setUpcoming] = useState<GardenTask[]>([]);

  // Recompute "today" when data refreshes (covers midnight edge while app is open).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshToken intentionally busts the cache
  const today = useMemo(() => toLocalDateString(new Date()), [refreshToken]);

  const reload = useCallback(() => {
    if (!ready || !taskRepository || !activeSeason) {
      setOverdue([]);
      setTodayTasks([]);
      setCompletedToday([]);
      setUpcoming([]);
      setLoading(false);
      return;
    }

    setOverdue(taskRepository.listOverdue(activeSeason.id, today));
    setTodayTasks(taskRepository.listForDate(activeSeason.id, today));
    setCompletedToday(taskRepository.listCompletedForDate(activeSeason.id, today));
    setUpcoming(taskRepository.listUpcoming(activeSeason.id, today, 7));
    setLoading(false);
  }, [ready, taskRepository, activeSeason, today]);

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

  const upcomingByDate = useMemo(() => {
    const map = new Map<string, GardenTask[]>();
    for (const task of upcoming) {
      const list = map.get(task.dueDate) ?? [];
      list.push(task);
      map.set(task.dueDate, list);
    }
    return map;
  }, [upcoming]);

  return {
    loading,
    today,
    overdue,
    todayTasks,
    completedToday,
    upcoming,
    upcomingByDate,
    reload,
  };
}
