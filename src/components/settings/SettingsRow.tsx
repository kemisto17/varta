import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { spacing, type ThemeColors } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useTheme';

type SettingsRowProps = {
  isLast?: boolean;
  label: string;
  onPress?: () => void;
  tone?: 'default' | 'danger';
  value?: string;
};

export function SettingsRow({
  isLast = false,
  label,
  onPress,
  tone = 'default',
  value,
}: SettingsRowProps) {
  const { colors, styles } = useThemedStyles(createStyles);
  const content = (
    <>
      <Text style={[styles.label, tone === 'danger' && styles.dangerLabel]}>
        {label}
      </Text>
      <View style={styles.trailing}>
        {value ? <Text style={styles.value}>{value}</Text> : null}
        {onPress ? (
          <SymbolView
            name={{
              android: 'chevron_right',
              ios: 'chevron.right',
              web: 'chevron_right',
            }}
            size={17}
            tintColor={colors.textMuted}
          />
        ) : null}
      </View>
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.row, isLast && styles.lastRow]}>{content}</View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        isLast && styles.lastRow,
        pressed && styles.pressed,
      ]}
    >
      {content}
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      minHeight: 56,
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
      flexShrink: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    dangerLabel: {
      color: colors.danger,
    },
    trailing: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    value: {
      maxWidth: 180,
      textAlign: 'right',
      fontSize: 13,
      color: colors.textSecondary,
    },
    pressed: {
      backgroundColor: colors.surfaceMuted,
    },
  });
