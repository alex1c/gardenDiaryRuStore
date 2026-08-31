/**
 * Edit or delete an expense record.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  ExpenseForm,
  type ExpenseFormValues,
} from '@/src/components/expense/ExpenseForm';
import { Screen } from '@/src/components/ui/Screen';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { useDatabase } from '@/src/providers/DatabaseProvider';

export default function EditExpenseScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bumpRefresh, expenseRepository } = useDatabase();
  const { loading, areas, plantings, catalogById } = useGardenSnapshot();
  const [saving, setSaving] = useState(false);

  const expense = useMemo(() => {
    if (!expenseRepository || !id) {
      return null;
    }
    return expenseRepository.getById(id);
  }, [expenseRepository, id]);

  const handleSubmit = (values: ExpenseFormValues) => {
    if (!expenseRepository || !expense) {
      return;
    }

    setSaving(true);
    try {
      expenseRepository.update(expense.id, {
        date: values.date,
        category: values.category,
        amountKopecks: values.amountKopecks,
        areaId: values.areaId,
        plantingId: values.plantingId,
        notes: values.notes,
      });
      bumpRefresh();
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!expenseRepository || !expense) {
      return;
    }

    Alert.alert('Удалить расход?', undefined, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          expenseRepository.delete(expense.id);
          bumpRefresh();
          router.back();
        },
      },
    ]);
  };

  if (loading || !expense) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll keyboardAvoiding keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Изменить расход</Text>
      <ExpenseForm
        areas={areas}
        plantings={plantings}
        catalogById={catalogById}
        initialExpense={expense}
        submitLabel="Сохранить"
        saving={saving}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        onDelete={handleDelete}
      />
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
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
});
