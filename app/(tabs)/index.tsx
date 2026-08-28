/**
 * Сегодня — central working screen: overdue, today, completed, upcoming tasks.
 */

import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CompletedTaskRow, TaskCard } from '@/src/components/task/TaskCard';
import { UndoBanner } from '@/src/components/task/UndoBanner';
import { Button } from '@/src/components/ui/Button';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Screen } from '@/src/components/ui/Screen';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { useTodayTasks } from '@/src/hooks/useTodayTasks';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { formatTaskTitle } from '@/src/services/taskDisplay';
import { HarvestStatsService } from '@/src/services/harvestStatsService';
import { completeTask, undoCompleteTask } from '@/src/services/taskCompletionService';
import { syncDailyReminder } from '@/src/services/notificationScheduler';
import { colors, spacing, typography } from '@/src/theme/tokens';
import { formatLocalDateLong, formatLocalDateShort } from '@/src/utils/dateFormatRu';
import { addDaysToLocalDate } from '@/src/utils/localDate';

export default function TodayScreen() {
  const router = useRouter();
  const { db, bumpRefresh, taskRepository, settingsRepository, refreshToken } = useDatabase();
  const { loading: gardenLoading, garden, season, areas, plantings, catalogById } =
    useGardenSnapshot();
  const {
    loading: tasksLoading,
    today,
    overdue,
    todayTasks,
    completedToday,
    upcomingByDate,
  } = useTodayTasks();

  const [undoTaskId, setUndoTaskId] = useState<string | null>(null);
  const [showUndo, setShowUndo] = useState(false);

  const areasById = useMemo(
    () => new Map(areas.map((area) => [area.id, area])),
    [areas]
  );
  const plantingsById = useMemo(
    () => new Map(plantings.map((p) => [p.id, p])),
    [plantings]
  );

  const hasActiveTasks = overdue.length > 0 || todayTasks.length > 0;
  const loading = gardenLoading || tasksLoading;

  const todayHarvestLines = useMemo(() => {
    if (!db || !season) {
      return [];
    }
    return new HarvestStatsService(db).getTodayHarvestLines(season.id, today);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshToken busts cache
  }, [db, season, today, refreshToken]);

  const handleComplete = useCallback(
    async (taskId: string) => {
      if (!db || !settingsRepository) {
        return;
      }
      completeTask(db, taskId, today);
      bumpRefresh();
      await syncDailyReminder(settingsRepository.getSettings());
      setUndoTaskId(taskId);
      setShowUndo(true);
    },
    [db, settingsRepository, today, bumpRefresh]
  );

  const handleUndo = useCallback(async () => {
    if (!db || !undoTaskId || !settingsRepository) {
      return;
    }
    undoCompleteTask(db, undoTaskId);
    bumpRefresh();
    await syncDailyReminder(settingsRepository.getSettings());
    setShowUndo(false);
    setUndoTaskId(null);
  }, [db, undoTaskId, settingsRepository, bumpRefresh]);

  const handlePostpone = useCallback(
    async (taskId: string, newDueDate: string) => {
      if (!taskRepository || !settingsRepository) {
        return;
      }
      taskRepository.postpone(taskId, newDueDate);
      bumpRefresh();
      await syncDailyReminder(settingsRepository.getSettings());
    },
    [taskRepository, settingsRepository, bumpRefresh]
  );

  const handleEdit = useCallback(
    (taskId: string) => {
      router.push({ pathname: '/task/edit', params: { id: taskId } });
    },
    [router]
  );

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!garden) {
    return (
      <Screen scroll>
        <EmptyState
          title="Добро пожаловать"
          message="Начните с вашего участка. Потом вы сможете добавить дела и посадки."
        >
          <Button
            title="Создать участок"
            onPress={() => router.push('/garden/create')}
          />
        </EmptyState>
      </Screen>
    );
  }

  if (!season) {
    return (
      <Screen scroll>
        <EmptyState
          title="Нет активного сезона"
          message="Создайте или активируйте сезон, чтобы планировать работы."
        />
      </Screen>
    );
  }

  return (
    <Screen scroll keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Сегодня</Text>
      <Text style={styles.dateLine}>{formatLocalDateLong(today)}</Text>
      <Text style={styles.sub}>
        {garden.name} · {season.title}
      </Text>

      <View style={styles.toolbar}>
        <Button
          title="+ Добавить дело"
          onPress={() => router.push('/task/create')}
        />
        <Button
          title="+ Урожай"
          variant="secondary"
          onPress={() => router.push('/harvest/create')}
        />
      </View>

      {todayHarvestLines.length > 0 ? (
        <View style={styles.harvestToday}>
          <Text style={styles.sectionTitle}>Сегодня собрано</Text>
          {todayHarvestLines.map((line) => (
            <Text key={line.label} style={styles.harvestLine}>
              {line.label} — {line.totalsText}
            </Text>
          ))}
        </View>
      ) : null}

      {!hasActiveTasks && completedToday.length === 0 ? (
        <EmptyState
          title="На сегодня дел нет"
          message="Можно заняться дачей в своём темпе 🌿"
        >
          <Button
            title="+ Добавить дело"
            onPress={() => router.push('/task/create')}
          />
        </EmptyState>
      ) : null}

      {overdue.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Просрочено</Text>
          <View style={styles.list}>
            {overdue.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                today={today}
                areasById={areasById}
                plantingsById={plantingsById}
                catalogById={catalogById}
                onComplete={handleComplete}
                onPostpone={handlePostpone}
                onEdit={handleEdit}
                showDueLabel
              />
            ))}
          </View>
        </View>
      ) : null}

      {todayTasks.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Сегодня</Text>
          <View style={styles.list}>
            {todayTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                today={today}
                areasById={areasById}
                plantingsById={plantingsById}
                catalogById={catalogById}
                onComplete={handleComplete}
                onPostpone={handlePostpone}
                onEdit={handleEdit}
              />
            ))}
          </View>
        </View>
      ) : null}

      {completedToday.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Выполнено сегодня</Text>
          <View style={styles.completedList}>
            {completedToday.map((task) => (
              <CompletedTaskRow
                key={task.id}
                task={task}
                onUndo={handleUndo}
              />
            ))}
          </View>
        </View>
      ) : null}

      {upcomingByDate.size > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ближайшие</Text>
          {[...upcomingByDate.entries()].map(([date, tasks]) => (
            <View key={date} style={styles.upcomingGroup}>
              <Text style={styles.upcomingDate}>
                {formatUpcomingHeading(date, today)}
              </Text>
              {tasks.map((task) => (
                <Text key={task.id} style={styles.upcomingItem}>
                  {formatTaskTitle(task)}
                </Text>
              ))}
            </View>
          ))}
        </View>
      ) : null}

      <UndoBanner
        visible={showUndo}
        message="Дело выполнено"
        onUndo={handleUndo}
        onDismiss={() => setShowUndo(false)}
      />
    </Screen>
  );
}

function formatUpcomingHeading(date: string, today: string): string {
  const tomorrow = addDaysToLocalDate(today, 1);
  if (date === tomorrow) {
    return 'Завтра';
  }
  return formatLocalDateShort(date);
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    ...typography.title,
    color: colors.text,
  },
  dateLine: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.xs,
  },
  sub: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  toolbar: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  harvestToday: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  harvestLine: {
    ...typography.body,
    color: colors.text,
  },
  section: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  list: {
    gap: spacing.sm,
  },
  completedList: {
    gap: spacing.xs,
  },
  upcomingGroup: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  upcomingDate: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  upcomingItem: {
    ...typography.body,
    color: colors.text,
    paddingLeft: spacing.sm,
  },
});
