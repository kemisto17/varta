import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, type ThemeColors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useTheme';

export type CreateContentType = 'post' | 'lost' | 'found';

const CREATE_TYPES: readonly {
  label: string;
  value: CreateContentType;
}[] = [
  { label: 'Post', value: 'post' },
  { label: 'Lost item', value: 'lost' },
  { label: 'Found item', value: 'found' },
];

type CreateTypeSelectorProps = {
  disabled?: boolean;
  onChange: (value: CreateContentType) => void;
  value: CreateContentType;
};

export function CreateTypeSelector({
  disabled = false,
  onChange,
  value,
}: CreateTypeSelectorProps) {
  const { colors, styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>WHAT ARE YOU SHARING?</Text>

      <View accessibilityRole="radiogroup" style={styles.options}>
        {CREATE_TYPES.map((option) => {
          const selected = option.value === value;

          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              key={option.value}
              onPress={() => {
                if (!selected) {
                  onChange(option.value);
                }
              }}
              style={({ pressed }) => [
                styles.option,
                selected && styles.optionSelected,
                pressed && !disabled && styles.pressed,
                disabled && styles.disabled,
              ]}
            >
              <SymbolView
                name={getSymbolName(option.value)}
                size={15}
                tintColor={selected ? colors.white : colors.textSecondary}
              />
              <Text
                style={[
                  styles.optionText,
                  selected && styles.optionTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function getSymbolName(value: CreateContentType) {
  if (value === 'lost') {
    return {
      android: 'search',
      ios: 'magnifyingglass',
      web: 'search',
    } as const;
  }

  if (value === 'found') {
    return {
      android: 'inventory_2',
      ios: 'shippingbox',
      web: 'inventory_2',
    } as const;
  }

  return {
    android: 'edit_note',
    ios: 'square.and.pencil',
    web: 'edit_note',
  } as const;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      marginTop: spacing.md,
      marginBottom: spacing.lg,
    },
    label: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.05,
      color: colors.textMuted,
    },
    options: {
      marginTop: spacing.sm,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    option: {
      minHeight: 40,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.full,
      backgroundColor: colors.surface,
    },
    optionSelected: {
      borderColor: colors.textPrimary,
      backgroundColor: colors.textPrimary,
    },
    optionText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    optionTextSelected: { color: colors.white },
    pressed: { opacity: 0.58 },
    disabled: { opacity: 0.45 },
  });
