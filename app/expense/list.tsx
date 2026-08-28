/**
 * Expense history list with category and area filters.
 */

import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Screen } from '@/src/components/ui/Screen';
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
} from '@/src/domain/codes';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { formatTaskRelationLabel } from '@/src/services/taskDisplay';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';
import {
  formatLocalDateLong,
  formatLocalDateShort,
} from '@/src/utils/dateFormatRu';
import { formatKopecksForDisplay } from '@/src/utils/money';
import { toLocalDateString } from '@/src/utils/localDate';

export default function ExpenseListScreen() {
  const router = useRouter();
  const { expenseRepository, refreshToken } = useDatabase();
  const { loading, season, areas, plantings, catalogById } = useGardenSnapshot();

  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | null>(
    null
  );
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const today = toLocalDateString(new Date());

  const areasById = useMemo(
    () => new Map(areas.map((area) => [area.id, area])),
    [areas]
  );
  const plantingsById = useMemo(
    () => new Map(plantings.map((p) => [p.id, p])),
    [plantings]
  );

  const expenses = useMemo(() => {
    if (!expenseRepository || !season) {
      return [];
    }
    let list = expenseRepository.listBySeason(season.id);
    if (categoryFilter) {
      list = list.filter((expense) => expense.category === categoryFilter);
    }
    if (areaFilter) {
      list = list.filter((expense) => {
        if (expense.areaId === areaFilter) {
          return true;
        }
        if (expense.plantingId) {
          const planting = plantingsById.get(expense.plantingId);
          return planting?.areaId === areaFilter;
        }
        return false;
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshToken busts cache
  }, [expenseRepository, season, categoryFilter, areaFilter, refreshToken, plantingsById]);

  const groupedExpenses = useMemo(() => {
    const map = new Map<string, typeof expenses>();
    for (const expense of expenses) {
      const list = map.get(expense.date) ?? [];
      list.push(expense);
      map.set(expense.date, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
      .map(([date, dateExpenses]) => ({ date, expenses: dateExpenses }));
  }, [expenses]);

  const filterLabel = useMemo(() => {
    const parts: string[] = [];
    if (categoryFilter) {
      parts.push(EXPENSE_CATEGORY_LABELS[categoryFilter]);
    }
    if (areaFilter) {
      parts.push(areasById.get(areaFilter)?.name ?? 'Зона');
    }
    return parts.length > 0 ? parts.join(' · ') : 'Все';
  }, [categoryFilter, areaFilter, areasById]);

  if (loading || !season) {
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
      <Text style={styles.heading}>Все расходы</Text>

      <View style={styles.toolbar}>
        <Button title={`Фильтр: ${filterLabel}`} variant="secondary" onPress={() => setFilterOpen(true)} />
        <Button title="+ Расход" onPress={() => router.push('/expense/create')} />
      </View>

      {expenses.length === 0 ? (
        <EmptyState
          title="Расходы пока не записаны"
          message="Добавляйте покупки и затраты, чтобы видеть стоимость сезона."
        >
          <Button title="+ Добавить расход" onPress={() => router.push('/expense/create')} />
        </EmptyState>
      ) : (
        groupedExpenses.map((group) => (
          <View key={group.date} style={styles.section}>
            <Text style={styles.sectionTitle}>
              {group.date === today
                ? `Сегодня · ${formatLocalDateShort(group.date)}`
                : formatLocalDateLong(group.date)}
            </Text>
            {group.expenses.map((expense) => (
              <Pressable
                key={expense.id}
                accessibilityRole="button"
                onPress={() =>
                  router.push({ pathname: '/expense/edit', params: { id: expense.id } })
                }
              >
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.category}>
                      {EXPENSE_CATEGORY_LABELS[expense.category]}
                    </Text>
                    <Text style={styles.amount}>
                      {formatKopecksForDisplay(expense.amountKopecks)}
                    </Text>
                  </View>
                  <Text style={styles.relation}>
                    {formatTaskRelationLabel(
                      expense.areaId,
                      expense.plantingId,
                      areasById,
                      plantingsById,
                      catalogById
                    )}
                  </Text>
                  {expense.notes ? (
                    <Text style={styles.notes}>{expense.notes}</Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        ))
      )}

      <Modal visible={filterOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Фильтр</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setCategoryFilter(null);
                setAreaFilter(null);
              }}
            >
              <Text style={styles.modalOption}>Сбросить</Text>
            </Pressable>
            <Text style={styles.modalSection}>Категория</Text>
            {EXPENSE_CATEGORIES.map((category) => (
              <Pressable
                key={category}
                accessibilityRole="button"
                onPress={() => setCategoryFilter(category)}
              >
                <Text style={styles.modalOption}>
                  {EXPENSE_CATEGORY_LABELS[category]}
                </Text>
              </Pressable>
            ))}
            <Text style={styles.modalSection}>Зона</Text>
            {areas.map((area) => (
              <Pressable
                key={area.id}
                accessibilityRole="button"
                onPress={() => setAreaFilter(area.id)}
              >
                <Text style={styles.modalOption}>{area.name}</Text>
              </Pressable>
            ))}
            <Button title="Готово" onPress={() => setFilterOpen(false)} />
          </View>
        </View>
      </Modal>
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
    marginBottom: spacing.md,
  },
  toolbar: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  category: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
  },
  amount: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
    flexShrink: 0,
  },
  relation: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  notes: {
    ...typography.body,
    color: colors.textSecondary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    maxHeight: '80%',
  },
  modalTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  modalSection: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  modalOption: {
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
});
