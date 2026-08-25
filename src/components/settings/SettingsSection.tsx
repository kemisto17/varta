import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { radius, spacing, type ThemeColors } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useTheme';

type SettingsSectionProps = PropsWithChildren<{
  description?: string;
  title: string;
}>;

export function SettingsSection({
  children,
  description,
  title,
}: SettingsSectionProps) {
  const { styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    section: {
      marginTop: spacing.xl,
    },
    title: {
      marginHorizontal: spacing.xs,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      color: colors.textMuted,
    },
    description: {
      marginTop: spacing.xs,
      marginHorizontal: spacing.xs,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    content: {
      marginTop: spacing.sm,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
    },
  });
