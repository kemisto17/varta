import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, type ThemeColors } from '../../constants/theme';
import type { ThemePreference } from '../../contexts/ThemeContext';
import { useThemedStyles } from '../../hooks/useTheme';

const OPTIONS: readonly { label: string; value: ThemePreference }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'Warm Ivory', value: 'warm' },
  { label: 'Ocean Blue', value: 'ocean' },
  { label: 'Forest Green', value: 'forest' },
  { label: 'Warm Dark', value: 'warm-dark' },
  { label: 'Ocean Dark', value: 'ocean-dark' },
  { label: 'Forest Dark', value: 'forest-dark' },
];

type ThemeSelectorProps = {
  onChange: (preference: ThemePreference) => void;
  value: ThemePreference;
};

export function ThemeSelector({ onChange, value }: ThemeSelectorProps) {
  const { colors, styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.grid}>
      {OPTIONS.map((option) => {
        const isSelected = option.value === value;

        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              isSelected && styles.optionSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.label, isSelected && styles.labelSelected]}
            >
              {option.label}
            </Text>
            {isSelected ? (
              <SymbolView
                name={{ android: 'check', ios: 'checkmark', web: 'check' }}
                size={12}
                tintColor={colors.white}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    grid: {
      padding: spacing.sm,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    option: {
      minHeight: 44,
      flexBasis: '30%',
      flexGrow: 1,
      paddingHorizontal: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
    },
    optionSelected: {
      borderColor: colors.textPrimary,
      backgroundColor: colors.textPrimary,
    },
    label: {
      flexShrink: 1,
      fontSize: 11,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    labelSelected: {
      color: colors.white,
    },
    pressed: {
      opacity: 0.7,
    },
  });
