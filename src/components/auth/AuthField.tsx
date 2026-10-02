import type { ReactNode } from 'react';
import type { TextInputProps } from 'react-native';
import { useThemedStyles } from '../../hooks/useTheme';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { radius, spacing, type ThemeColors } from '../../constants/theme';

type AuthFieldProps = TextInputProps & {
  label: string;
  rightAccessory?: ReactNode;
};

export function AuthField({ label, rightAccessory, style, ...inputProps }: AuthFieldProps) {
  const { colors, styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={rightAccessory ? styles.inputShell : undefined}>
        <TextInput
          {...inputProps}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.textPrimary}
          style={[styles.input, rightAccessory ? styles.inputWithAccessory : null, style]}
        />
        {rightAccessory ? <View style={styles.accessory}>{rightAccessory}</View> : null}
      </View>
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

  inputShell: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },

  inputWithAccessory: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },

  accessory: {
    paddingRight: spacing.md,
  },
});
