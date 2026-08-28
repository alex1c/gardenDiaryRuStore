/**
 * Root layout — DatabaseProvider and stack navigation.
 */

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { DatabaseProvider, useDatabase } from '@/src/providers/DatabaseProvider';
import { configureNotificationHandler } from '@/src/services/notificationScheduler';
import { colors, spacing, typography } from '@/src/theme/tokens';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();
configureNotificationHandler();

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <RootNavigator />
    </DatabaseProvider>
  );
}

function RootNavigator() {
  const { ready, error } = useDatabase();

  useEffect(() => {
    if (ready || error) {
      SplashScreen.hideAsync();
    }
  }, [ready, error]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Не удалось открыть базу данных</Text>
        <Text style={styles.errorBody}>{error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loading}>Загрузка…</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="garden/create"
          options={{ title: 'Новый участок', presentation: 'modal' }}
        />
        <Stack.Screen
          name="area/create"
          options={{ title: 'Новая зона', presentation: 'modal' }}
        />
        <Stack.Screen
          name="area/[id]"
          options={{ title: 'Зона' }}
        />
        <Stack.Screen
          name="area/edit"
          options={{ title: 'Редактировать зону', presentation: 'modal' }}
        />
        <Stack.Screen
          name="planting/create"
          options={{ title: 'Добавить культуру', presentation: 'modal' }}
        />
        <Stack.Screen
          name="planting/[id]"
          options={{ title: 'Посадка' }}
        />
        <Stack.Screen
          name="planting/edit"
          options={{ title: 'Редактировать', presentation: 'modal' }}
        />
        <Stack.Screen
          name="event/create"
          options={{ title: 'Новая запись', presentation: 'modal' }}
        />
        <Stack.Screen
          name="event/edit"
          options={{ title: 'Запись', presentation: 'modal' }}
        />
        <Stack.Screen
          name="task/create"
          options={{ title: 'Новое дело', presentation: 'modal' }}
        />
        <Stack.Screen
          name="task/edit"
          options={{ title: 'Дело', presentation: 'modal' }}
        />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  loading: {
    ...typography.body,
    color: colors.textSecondary,
  },
  errorTitle: {
    ...typography.subtitle,
    color: colors.error,
    textAlign: 'center',
  },
  errorBody: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
