import { useThemedStyles } from '../../hooks/useTheme';
import { StyleSheet, Text, View } from 'react-native';

import { radius, spacing, type ThemeColors } from '../../constants/theme';
import type { ProfileBadge } from '../../types/badge';

type BadgePillProps = {
  badge: ProfileBadge;
  compact?: boolean;
};

export function BadgePill({ badge, compact = false }: BadgePillProps) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View
      accessibilityLabel={`${badge.name}${
        badge.visibility === 'owner_only' ? ', private badge' : ', badge'
      }`}
      accessible
      style={[styles.pill, compact && styles.compactPill]}
    >
      <Text style={[styles.icon, compact && styles.compactIcon]}>
        {badge.icon}
      </Text>
      <Text
        numberOfLines={1}
        style={[styles.name, compact && styles.compactName]}
      >
        {badge.name}
      </Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  pill: {
    minHeight: 30,
    maxWidth: 190,
    paddingHorizontal: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
  },

  compactPill: {
    minHeight: 22,
    maxWidth: 132,
    paddingHorizontal: 7,
    gap: 4,
    backgroundColor: colors.background,
  },

  icon: {
    fontSize: 11,
    color: colors.textSecondary,
  },

  compactIcon: {
    fontSize: 9,
  },

  name: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  compactName: {
    fontSize: 9,
    letterSpacing: 0.1,
  },
});
