/**
 * Daily local notification scheduler for garden task reminders.
 *
 * Model: one generic daily summary notification at a configurable local time.
 * Dynamic per-task text is not embedded — expo-notifications cannot reliably
 * rebuild a task list without background execution. The message nudges the
 * user to open the app where the Today tab shows actual tasks.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { AppSettings } from '@/src/domain/types';
import { parseNotificationTime } from '@/src/utils/dateFormatRu';

export const DAILY_REMINDER_NOTIFICATION_ID = 'daily-garden-task-reminder';

const REMINDER_TITLE = 'Моя дача';
const REMINDER_BODY =
  'Загляните в «Мою дачу» — на сегодня запланированы работы.';

/** Configures foreground notification presentation (minimal). */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/** Returns true when the OS granted notification permission. */
export async function getNotificationPermissionGranted(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  return (
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

/**
 * Requests system notification permission.
 * Call only after the user explicitly taps "Включить".
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Напоминания',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const result = await Notifications.requestPermissionsAsync();
  return (
    result.granted ||
    result.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

/** Cancels the scheduled daily reminder if present. */
export async function cancelDailyReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(
      DAILY_REMINDER_NOTIFICATION_ID
    );
  } catch {
    // Ignore cancel errors — notification may not exist yet.
  }
}

/**
 * Schedules (or reschedules) the generic daily reminder based on settings.
 * No-op when notifications are disabled.
 */
export async function syncDailyReminder(settings: AppSettings): Promise<void> {
  await cancelDailyReminder();

  if (!settings.notificationsEnabled) {
    return;
  }

  const granted = await getNotificationPermissionGranted();
  if (!granted) {
    return;
  }

  const { hour, minute } = parseNotificationTime(settings.notificationTime);

  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_NOTIFICATION_ID,
    content: {
      title: REMINDER_TITLE,
      body: REMINDER_BODY,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}
