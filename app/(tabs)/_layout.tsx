/**
 * Main tab navigator — five Phase 0 sections with Russian titles.
 * Initial route is Сегодня (index).
 */

import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { colors, touchTarget } from '@/src/theme/tokens';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text, fontSize: 18 },
        tabBarStyle: {
          minHeight: touchTarget.min + 8,
          paddingBottom: 4,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Сегодня',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sunny-outline" size={Math.max(size, 24)} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="plot"
        options={{
          title: 'Участок',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map-outline" size={Math.max(size, 24)} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: 'Дневник',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" size={Math.max(size, 24)} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Статистика',
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="bar-chart-outline"
              size={Math.max(size, 24)}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Ещё',
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="ellipsis-horizontal-circle-outline"
              size={Math.max(size, 24)}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
