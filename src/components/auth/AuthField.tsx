import type { TextInputProps } from 'react-native';
import { useThemedStyles } from '../../hooks/useTheme';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { radius, spacing, type ThemeColors } from '../../constants/theme';

type AuthFieldProps = TextInputProps & {
  label: string;
};

export function AuthField({ label, style, ...inputProps }: AuthFieldProps) {
  const { colors, styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.textPrimary}
        style={[styles.input, style]}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    gap: spacing.sm,
  },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  input: {
    minHeight: 54,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    fontSize: 16,
    color: colors.textPrimary,
  },
});
