/**
 * Active task card for the Today screen with complete / postpone / edit actions.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import type { GardenArea, GardenTask, PlantCatalogItem, Planting } from '@/src/domain/types';
import {
	formatTaskRelationSubtitle,
	formatTaskRepeatLabel,
	formatTaskTitle,
	formatWorkTypeLabel,
} from '@/src/services/taskDisplay';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';
import { formatDueDateRelative, formatLocalDateShort } from '@/src/utils/dateFormatRu';

import { PostponeTaskModal } from './PostponeTaskModal';

type TaskCardProps = {
	task: GardenTask;
	today: string;
	areasById: Map<string, GardenArea>;
	plantingsById: Map<string, Planting>;
	catalogById: Map<string, PlantCatalogItem>;
	onComplete: (taskId: string) => void;
	onPostpone: (taskId: string, newDueDate: string) => void;
	onEdit: (taskId: string) => void;
	showDueLabel?: boolean;
};

export function TaskCard({
	task,
	today,
	areasById,
	plantingsById,
	catalogById,
	onComplete,
	onPostpone,
	onEdit,
	showDueLabel = false,
}: TaskCardProps) {
	const [postponeOpen, setPostponeOpen] = useState(false);
	const subtitle = formatTaskRelationSubtitle(
		task,
		areasById,
		plantingsById,
		catalogById
	);
	const repeatLabel = formatTaskRepeatLabel(task);
	const isOverdue = task.dueDate < today;
	const typeLabel = formatWorkTypeLabel(task.type);

	return (
		<>
			<Card style={[styles.card, isOverdue ? styles.cardOverdue : null]}>
				<Pressable accessibilityRole="button" onPress={() => onEdit(task.id)}>
					<View style={styles.headerRow}>
						<Text style={styles.title}>{formatTaskTitle(task)}</Text>
						{isOverdue ? (
							<View style={styles.overdueBadge}>
								<Text style={styles.overdueBadgeText}>Просрочено</Text>
							</View>
						) : null}
					</View>
					<Text style={styles.typeLine}>{typeLabel}</Text>
					{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
					{repeatLabel ? (
						<Text style={styles.repeat}>↻ {repeatLabel}</Text>
					) : null}
					{showDueLabel || isOverdue ? (
						<Text style={[styles.due, isOverdue ? styles.dueOverdue : null]}>
							{formatDueDateRelative(task.dueDate, today)} ·{' '}
							{formatLocalDateShort(task.dueDate)}
						</Text>
					) : null}
				</Pressable>
				{/* Primary full-width, then two equal secondary actions —
				    avoids wrapping long Russian labels at 360/390dp. */}
				<View style={styles.actions}>
					<Button
						title="Готово"
						onPress={() => onComplete(task.id)}
						style={styles.primaryAction}
					/>
					<View style={styles.secondaryActions}>
						<Button
							title="Перенести"
							variant="secondary"
							onPress={() => setPostponeOpen(true)}
							style={styles.secondaryAction}
						/>
						<Button
							title="Изменить"
							variant="secondary"
							onPress={() => onEdit(task.id)}
							style={styles.secondaryAction}
						/>
					</View>
				</View>
			</Card>

			<PostponeTaskModal
				visible={postponeOpen}
				today={today}
				initialDate={task.dueDate}
				onClose={() => setPostponeOpen(false)}
				onConfirm={(newDueDate) => {
					setPostponeOpen(false);
					onPostpone(task.id, newDueDate);
				}}
			/>
		</>
	);
}

/** Compact row for tasks completed today. */
export function CompletedTaskRow({
	task,
	onUndo,
}: {
	task: GardenTask;
	onUndo?: (taskId: string) => void;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			onPress={onUndo ? () => onUndo(task.id) : undefined}
			style={styles.completedRow}
		>
			<Text style={styles.completedText}>✓ {formatTaskTitle(task)}</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	card: {
		gap: spacing.sm,
	},
	cardOverdue: {
		borderColor: colors.warning,
		backgroundColor: '#FFFAF5',
	},
	headerRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		justifyContent: 'space-between',
		gap: spacing.sm,
	},
	title: {
		...typography.subtitle,
		color: colors.text,
		flex: 1,
	},
	typeLine: {
		...typography.caption,
		color: colors.textMuted,
		marginTop: spacing.xs,
		fontWeight: '600',
	},
	subtitle: {
		...typography.body,
		color: colors.textSecondary,
		marginTop: spacing.xs,
	},
	repeat: {
		...typography.caption,
		color: colors.primary,
		marginTop: spacing.xs,
	},
	due: {
		...typography.caption,
		color: colors.textSecondary,
		marginTop: spacing.xs,
	},
	dueOverdue: {
		color: colors.warning,
		fontWeight: '600',
	},
	overdueBadge: {
		backgroundColor: '#FEE4D6',
		borderRadius: radii.sm,
		paddingHorizontal: spacing.sm,
		paddingVertical: 2,
	},
	overdueBadgeText: {
		...typography.caption,
		color: colors.warning,
		fontWeight: '700',
	},
	actions: {
		gap: spacing.sm,
	},
	primaryAction: {
		alignSelf: 'stretch',
	},
	secondaryActions: {
		flexDirection: 'row',
		gap: spacing.sm,
	},
	secondaryAction: {
		flex: 1,
	},
	completedRow: {
		paddingVertical: spacing.xs,
	},
	completedText: {
		...typography.body,
		color: colors.textMuted,
	},
});
