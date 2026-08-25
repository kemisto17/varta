import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { spacing, type ThemeColors } from '../../constants/theme';
import type { ThemePreference } from '../../contexts/ThemeContext';
import { useThemedStyles } from '../../hooks/useTheme';

const OPTIONS: readonly { label: string; value: ThemePreference }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

type ThemeSelectorProps = {
  onChange: (preference: ThemePreference) => void;
  value: ThemePreference;
};

export function ThemeSelector({ onChange, value }: ThemeSelectorProps) {
  const { colors, styles } = useThemedStyles(createStyles);

  return (
    <View>
      {OPTIONS.map((option, index) => {
        const isSelected = option.value === value;

        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              index === OPTIONS.length - 1 && styles.lastOption,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.label}>{option.label}</Text>
            <View
              style={[styles.radio, isSelected && styles.radioSelected]}
            >
              {isSelected ? (
                <SymbolView
                  name={{ android: 'check', ios: 'checkmark', web: 'check' }}
                  size={14}
                  tintColor={colors.white}
                />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    option: {
      minHeight: 54,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    lastOption: {
      borderBottomWidth: 0,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    radio: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
    },
    radioSelected: {
      borderColor: colors.textPrimary,
      backgroundColor: colors.textPrimary,
    },
    pressed: {
      backgroundColor: colors.surfaceMuted,
    },
  });
