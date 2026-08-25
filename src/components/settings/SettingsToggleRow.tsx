import { StyleSheet, Switch, Text, View } from 'react-native';

import { spacing, type ThemeColors } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useTheme';

type SettingsToggleRowProps = {
  disabled?: boolean;
  isLast?: boolean;
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
};

export function SettingsToggleRow({
  disabled = false,
  isLast = false,
  label,
  onValueChange,
  value,
}: SettingsToggleRowProps) {
  const { colors, styles } = useThemedStyles(createStyles);

  return (
    <View style={[styles.row, isLast && styles.lastRow]}>
      <Text style={[styles.label, disabled && styles.disabled]}>{label}</Text>
      <Switch
        accessibilityLabel={`${label} notifications`}
        disabled={disabled}
        ios_backgroundColor={colors.border}
        onValueChange={onValueChange}
        thumbColor={value ? colors.white : colors.surfaceElevated}
        trackColor={{ false: colors.border, true: colors.textPrimary }}
        value={value}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      minHeight: 58,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    lastRow: {
      borderBottomWidth: 0,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    disabled: {
      color: colors.textMuted,
    },
  });
