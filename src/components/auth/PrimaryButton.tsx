import { useThemedStyles } from '../../hooks/useTheme';
import { ActivityIndicator, Pressable, StyleSheet, Text, } from 'react-native';

import { radius, type ThemeColors } from '../../constants/theme';

type PrimaryButtonProps = {
  disabled?: boolean;
  isLoading?: boolean;
  label: string;
  onPress: () => void;
};

export function PrimaryButton({
  disabled = false,
  isLoading = false,
  label,
  onPress,
}: PrimaryButtonProps) {
  const { colors, styles } = useThemedStyles(createStyles);
  const isDisabled = disabled || isLoading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  button: {
    minHeight: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textPrimary,
  },

  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },

  pressed: {
    opacity: 0.78,
  },

  disabled: {
    opacity: 0.55,
  },
});
