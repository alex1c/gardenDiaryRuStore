/**
 * Garden area details — plantings list and actions.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Screen } from '@/src/components/ui/Screen';
import { GARDEN_AREA_TYPE_LABELS, PLANTING_STATUS_LABELS } from '@/src/domain/codes';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { formatEventHeadline } from '@/src/services/eventDisplay';
import {
  formatAreaDimensions,
  formatCatalogLabel,
  formatQuantityWithUnit,
} from '@/src/services/plantingDisplay';
import { colors, spacing, typography } from '@/src/theme/tokens';
import { formatLocalDateShort } from '@/src/utils/dateFormatRu';

export default function AreaDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready, areaRepository, eventRepository, refreshToken } = useDatabase();
  const { loading, season, catalogById, plantingsByAreaId } = useGardenSnapshot();

  const area = useMemo(() => {
    if (!ready || !areaRepository || !id) {
      return null;
    }
    return areaRepository.getById(id);
  }, [ready, areaRepository, id]);

  const recentEvents = useMemo(() => {
    if (!eventRepository || !id) {
      return [];
    }
    return eventRepository.listByArea(id, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshToken busts cache after mutations
  }, [eventRepository, id, refreshToken]);

  const plantings = id ? plantingsByAreaId.get(id) ?? [] : [];
  const dimensions = area ? formatAreaDimensions(area.length, area.width) : null;

  if (loading || !ready || !area) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>{area.name}</Text>
      <Text style={styles.type}>{GARDEN_AREA_TYPE_LABELS[area.type]}</Text>
      {dimensions ? <Text style={styles.meta}>{dimensions}</Text> : null}
      {area.notes ? <Text style={styles.notes}>{area.notes}</Text> : null}

      <View style={styles.toolbar}>
        <Button
          title="Редактировать зону"
          variant="secondary"
          onPress={() => router.push({ pathname: '/area/edit', params: { id: area.id } })}
        />
        <Button
          title="+ Добавить культуру"
          onPress={() =>
            router.push({
              pathname: '/planting/create',
              params: { areaId: area.id },
            })
          }
        />
        <Button
          title="+ Дело"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/task/create',
              params: { areaId: area.id },
            })
          }
        />
        <Button
          title="+ Запись"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/event/create',
              params: { areaId: area.id },
            })
          }
        />
        <Button
          title="+ Расход"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/expense/create',
              params: { areaId: area.id },
            })
          }
        />
      </View>

      {recentEvents.length > 0 ? (
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Последние записи</Text>
          {recentEvents.map((event) => (
            <Pressable
              key={event.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/event/edit', params: { id: event.id } })
              }
            >
              <Card style={styles.eventCard}>
                <Text style={styles.eventDate}>
                  {formatLocalDateShort(event.eventDate)}
                </Text>
                <Text style={styles.eventTitle}>{formatEventHeadline(event)}</Text>
                <Text style={styles.eventBody}>{event.title}</Text>
              </Card>
            </Pressable>
          ))}
          <Button
            title="Вся история"
            variant="ghost"
            onPress={() =>
              router.push({
                pathname: '/(tabs)/diary',
                params: { areaId: area.id },
              })
            }
          />
        </View>
      ) : null}

      {plantings.length === 0 ? (
        <EmptyState
          title="Пока пусто"
          message="Здесь пока ничего не посажено."
        >
          <Button
            title="+ Добавить культуру"
            onPress={() =>
              router.push({
                pathname: '/planting/create',
                params: { areaId: area.id },
              })
            }
          />
        </EmptyState>
      ) : (
        <View style={styles.list}>
          {plantings.map((planting) => {
            const catalog = catalogById.get(planting.catalogItemId);
            const label = catalog ? formatCatalogLabel(catalog) : 'Посадка';
            const qty = formatQuantityWithUnit(
              planting.quantity,
              planting.quantityUnit
            );

            return (
              <Pressable
                key={planting.id}
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: '/planting/[id]',
                    params: { id: planting.id },
                  })
                }
              >
                <Card style={styles.plantingCard}>
                  <Text style={styles.plantingTitle} numberOfLines={2}>
                    {label}
                  </Text>
                  {qty ? (
                    <Text style={styles.plantingMeta} numberOfLines={1}>
                      {qty}
                    </Text>
                  ) : null}
                  <Text style={styles.plantingStatus}>
                    {PLANTING_STATUS_LABELS[planting.status]}
                  </Text>
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}

      {!season ? (
        <Text style={styles.warning}>
          Активный сезон не найден — посадки могут быть недоступны.
        </Text>
      ) : null}
    </Screen>
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
  },
  type: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  notes: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  toolbar: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
  plantingCard: {
    gap: spacing.xs,
  },
  plantingTitle: {
    ...typography.subtitle,
    color: colors.text,
    flexShrink: 1,
  },
  plantingMeta: {
    ...typography.body,
    color: colors.textSecondary,
  },
  plantingStatus: {
    ...typography.caption,
    color: colors.textMuted,
  },
  warning: {
    ...typography.caption,
    color: colors.warning,
    marginTop: spacing.md,
  },
  historySection: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  eventCard: {
    gap: spacing.xs,
  },
  eventDate: {
    ...typography.caption,
    color: colors.textMuted,
  },
  eventTitle: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  eventBody: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
