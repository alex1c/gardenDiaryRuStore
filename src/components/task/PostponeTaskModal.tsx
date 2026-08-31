/**
 * Quick postpone sheet — tomorrow, +3 days, or custom date picker.
 */

import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { LocalDatePicker } from '@/src/components/date/LocalDatePicker';
import { Button } from '@/src/components/ui/Button';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';
import { addDaysToLocalDate } from '@/src/utils/localDate';

type PostponeTaskModalProps = {
	visible: boolean;
	today: string;
	initialDate: string;
	onClose: () => void;
	onConfirm: (newDueDate: string) => void;
};

export function PostponeTaskModal({
	visible,
	today,
	initialDate,
	onClose,
	onConfirm,
}: PostponeTaskModalProps) {
	const [pickedDate, setPickedDate] = useState(initialDate);

	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
			<Pressable style={styles.backdrop} onPress={onClose}>
				<Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
					<Text style={styles.title}>Перенести дело</Text>

					<View style={styles.quickRow}>
						<Button
							title="Завтра"
							variant="secondary"
							onPress={() => onConfirm(addDaysToLocalDate(today, 1))}
						/>
						<Button
							title="+3 дня"
							variant="secondary"
							onPress={() => onConfirm(addDaysToLocalDate(today, 3))}
						/>
					</View>

					<LocalDatePicker
						label="Или выберите дату"
						value={pickedDate}
						onChange={setPickedDate}
					/>

					<View style={styles.actions}>
						<Button title="Сохранить" onPress={() => onConfirm(pickedDate)} />
						<Button title="Отмена" variant="ghost" onPress={onClose} />
					</View>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.4)',
		justifyContent: 'center',
		padding: spacing.lg,
	},
	card: {
		backgroundColor: colors.surface,
		borderRadius: radii.lg,
		padding: spacing.lg,
		gap: spacing.md,
		maxWidth: 420,
		width: '100%',
		alignSelf: 'center',
	},
	title: {
		...typography.subtitle,
		color: colors.text,
	},
	quickRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.sm,
	},
	actions: {
		gap: spacing.sm,
		marginTop: spacing.sm,
	},
});
