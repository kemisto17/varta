import { useThemedStyles } from '../../hooks/useTheme';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, type ThemeColors } from '../../constants/theme';
import type { ProfileBadge } from '../../types/badge';
import { BadgePill } from './BadgePill';

type ProfileBadgesProps = {
  badges: ProfileBadge[];
  maxVisible?: number;
};

export function ProfileBadges({
  badges,
  maxVisible = 4,
}: ProfileBadgesProps) {
  const { styles } = useThemedStyles(createStyles);
  const [isExpanded, setIsExpanded] = useState(false);
  const hasOverflow = badges.length > maxVisible;
  const visibleBadges = isExpanded ? badges : badges.slice(0, maxVisible);

  useEffect(() => {
    setIsExpanded(false);
  }, [badges]);

  if (badges.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>BADGES</Text>
      <View style={styles.badges}>
        {visibleBadges.map((badge) => (
          <BadgePill badge={badge} key={badge.id} />
        ))}

        {hasOverflow ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsExpanded((current) => !current)}
            style={({ pressed }) => [
              styles.moreButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.moreText}>
              {isExpanded ? 'Show less' : `+${badges.length - maxVisible} more`}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    width: '100%',
    marginTop: spacing.lg,
    alignItems: 'flex-start',
  },

  eyebrow: {
    marginBottom: spacing.sm,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.textMuted,
  },

  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: spacing.sm,
  },

  moreButton: {
    minHeight: 30,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  moreText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },

  pressed: {
    opacity: 0.55,
  },
});
