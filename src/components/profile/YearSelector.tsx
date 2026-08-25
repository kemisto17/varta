import { useThemedStyles } from '../../hooks/useTheme';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, type ThemeColors } from '../../constants/theme';

type YearSelectorProps = {
  onChange: (year: number) => void;
  value: number | null;
};

const YEARS = [1, 2, 3, 4, 5, 6] as const;

export function YearSelector({ onChange, value }: YearSelectorProps) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Current year</Text>

      <View style={styles.options}>
        {YEARS.map((year) => {
          const isSelected = value === year;

          return (
            <Pressable
              accessibilityRole="button"
              key={year}
              onPress={() => onChange(year)}
              style={({ pressed }) => [
                styles.option,
                isSelected && styles.optionSelected,
                pressed && styles.optionPressed,
              ]}
            >
              <Text
                style={[
                  styles.optionLabel,
                  isSelected && styles.optionLabelSelected,
                ]}
              >
                {year}
              </Text>
            </Pressable>
          );
        })}
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

  options: {
    flexDirection: 'row',
    gap: spacing.sm,
  },

  option: {
    minWidth: 42,
    height: 44,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },

  optionSelected: {
    borderColor: colors.textPrimary,
    backgroundColor: colors.textPrimary,
  },

  optionPressed: {
    opacity: 0.72,
  },

  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  optionLabelSelected: {
    color: colors.white,
  },
});
