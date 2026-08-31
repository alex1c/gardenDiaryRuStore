/**
 * Screen shell: SafeAreaView with optional ScrollView, keyboard avoidance, theme padding.
 */

import React, { type ReactNode } from 'react';
import {
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	StyleSheet,
	View,
	type StyleProp,
	type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/src/theme/tokens';

type ScreenProps = {
	children: ReactNode;
	scroll?: boolean;
	/** Keeps focused fields reachable when the keyboard is open (form screens). */
	keyboardAvoiding?: boolean;
	style?: StyleProp<ViewStyle>;
	contentStyle?: StyleProp<ViewStyle>;
	keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
};

export function Screen({
	children,
	scroll = false,
	keyboardAvoiding = false,
	style,
	contentStyle,
	keyboardShouldPersistTaps = 'handled',
}: ScreenProps) {
	const body = scroll ? (
		<ScrollView
			contentContainerStyle={[styles.content, contentStyle]}
			keyboardShouldPersistTaps={keyboardShouldPersistTaps}
			keyboardDismissMode="on-drag"
		>
			{children}
		</ScrollView>
	) : (
		<View style={[styles.content, styles.flex, contentStyle]}>{children}</View>
	);

	const wrappedBody = keyboardAvoiding ? (
		<KeyboardAvoidingView
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			style={styles.flex}
			keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
		>
			{body}
		</KeyboardAvoidingView>
	) : (
		body
	);

	return (
		<SafeAreaView style={[styles.safe, style]} edges={['top', 'left', 'right']}>
			{wrappedBody}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safe: {
		flex: 1,
		backgroundColor: colors.background,
	},
	flex: {
		flex: 1,
	},
	content: {
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.md,
		paddingBottom: spacing.xl,
	},
});

export default Screen;
