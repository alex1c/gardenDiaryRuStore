/**
 * Дневник — minimal chronological list of GardenEvents from completed tasks.
 */

import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Screen } from '@/src/components/ui/Screen';
import { WORK_TYPE_LABELS } from '@/src/domain/codes';
import type { GardenEvent } from '@/src/domain/types';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { formatTaskRelationSubtitle } from '@/src/services/taskDisplay';
import { colors, spacing, typography } from '@/src/theme/tokens';
import { formatLocalDateShort } from '@/src/utils/dateFormatRu';
import { toLocalDateString } from '@/src/utils/localDate';
import { useMemo } from 'react';

export default function DiaryScreen() {
  const { loading: gardenLoading, season, areas, plantings, catalogById } =
    useGardenSnapshot();
  const { ready, eventRepository } = useDatabase();

  const areasById = useMemo(
    () => new Map(areas.map((area) => [area.id, area])),
    [areas]
  );
  const plantingsById = useMemo(
    () => new Map(plantings.map((p) => [p.id, p])),
    [plantings]
  );

  const events = useMemo(() => {
    if (!ready || !eventRepository || !season) {
      return [] as GardenEvent[];
    }
    return eventRepository.listBySeason(season.id);
  }, [ready, eventRepository, season]);

  const today = toLocalDateString(new Date());
  const todayEvents = events.filter((e) => e.eventDate === today);
  const olderEvents = events.filter((e) => e.eventDate !== today);

  if (gardenLoading || !ready) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!season) {
    return (
      <Screen scroll>
        <EmptyState
          title="Дневник"
          message="Активный сезон не найден."
        />
      </Screen>
    );
  }

  if (events.length === 0) {
    return (
      <Screen scroll>
        <EmptyState
          title="Дневник пуст"
          message="Здесь появится история выполненных дел."
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={styles.heading}>Дневник</Text>

      {todayEvents.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Сегодня</Text>
          {todayEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              areasById={areasById}
              plantingsById={plantingsById}
              catalogById={catalogById}
            />
          ))}
        </View>
      ) : null}

      {olderEvents.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ранее</Text>
          {olderEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              areasById={areasById}
              plantingsById={plantingsById}
              catalogById={catalogById}
              showDate
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function EventCard({
  event,
  areasById,
  plantingsById,
  catalogById,
  showDate = false,
}: {
  event: GardenEvent;
  areasById: Map<string, import('@/src/domain/types').GardenArea>;
  plantingsById: Map<string, import('@/src/domain/types').Planting>;
  catalogById: Map<string, import('@/src/domain/types').PlantCatalogItem>;
  showDate?: boolean;
}) {
  const subtitle = formatTaskRelationSubtitle(
    event,
    areasById,
    plantingsById,
    catalogById
  );

  return (
    <Card style={styles.card}>
      {showDate ? (
        <Text style={styles.date}>{formatLocalDateShort(event.eventDate)}</Text>
      ) : null}
      <Text style={styles.eventTitle}>
        ✓ {WORK_TYPE_LABELS[event.type]}
      </Text>
      <Text style={styles.eventWork}>{event.title}</Text>
      {subtitle ? <Text style={styles.eventSub}>{subtitle}</Text> : null}
    </Card>
  );
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
    marginBottom: spacing.md,
  },
  section: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  card: {
    gap: spacing.xs,
  },
  date: {
    ...typography.caption,
    color: colors.textMuted,
  },
  eventTitle: {
    ...typography.subtitle,
    color: colors.success,
  },
  eventWork: {
    ...typography.body,
    color: colors.text,
  },
  eventSub: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
