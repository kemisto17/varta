import { useThemedStyles } from '../hooks/useTheme';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { spacing, type ThemeColors } from '../constants/theme';

type ScreenHeaderProps = {
  action?: React.ReactNode;
  fallbackRoute?: '/' | '/events';
  title: string;
};

export function ScreenHeader({
  action = null,
  fallbackRoute = '/',
  title,
}: ScreenHeaderProps) {
  const { colors, styles } = useThemedStyles(createStyles);
  const router = useRouter();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallbackRoute);
    }
  };

  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Go back"
        accessibilityRole="button"
        hitSlop={10}
        onPress={goBack}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <SymbolView
          name={{ android: 'arrow_back', ios: 'chevron.left', web: 'arrow_back' }}
          size={22}
          tintColor={colors.textPrimary}
        />
      </Pressable>
      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <View style={styles.action}>{action}</View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  header: {
    minHeight: 60,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 19,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  action: {
    minWidth: 44,
    alignItems: 'flex-end',
  },
  pressed: { opacity: 0.55 },
});
