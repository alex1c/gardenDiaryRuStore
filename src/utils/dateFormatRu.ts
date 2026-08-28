/**
 * Russian formatting helpers for local calendar dates (YYYY-MM-DD).
 */

import { parseLocalDate } from '@/src/utils/localDate';

const WEEKDAY_LABELS: readonly string[] = [
  'воскресенье',
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
];

const MONTH_GENITIVE: readonly string[] = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

/** Capitalizes the first letter of a Russian string. */
function capitalize(value: string): string {
  if (value.length === 0) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Formats a local date as "Пятница, 28 августа". */
export function formatLocalDateLong(localDate: string): string {
  const date = parseLocalDate(localDate);
  const weekday = capitalize(WEEKDAY_LABELS[date.getDay()]);
  const day = date.getDate();
  const month = MONTH_GENITIVE[date.getMonth()];
  return `${weekday}, ${day} ${month}`;
}

/** Formats a local date as "28 августа". */
export function formatLocalDateShort(localDate: string): string {
  const date = parseLocalDate(localDate);
  return `${date.getDate()} ${MONTH_GENITIVE[date.getMonth()]}`;
}

/** Returns a relative label for task due dates (Сегодня / Завтра / Вчера / date). */
export function formatDueDateRelative(
  dueDate: string,
  today: string
): string {
  if (dueDate === today) {
    return 'Сегодня';
  }

  const tomorrow = addOneDay(today);
  if (dueDate === tomorrow) {
    return 'Завтра';
  }

  const yesterday = addOneDay(dueDate);
  if (yesterday === today) {
    return 'Вчера';
  }

  return formatLocalDateShort(dueDate);
}

function addOneDay(localDate: string): string {
  const date = parseLocalDate(localDate);
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parses HH:mm into hour and minute; falls back to 09:00. */
export function parseNotificationTime(
  value: string
): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return { hour: 9, minute: 0 };
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return { hour: 9, minute: 0 };
  }
  return { hour, minute };
}

/** Formats hour/minute as zero-padded HH:mm. */
export function formatNotificationTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
