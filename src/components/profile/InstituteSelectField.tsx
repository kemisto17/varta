import { useThemedStyles } from '../../hooks/useTheme';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, type ThemeColors } from '../../constants/theme';
import type { InstituteOption } from '../../lib/profile';

type InstituteSelectFieldProps = {
  disabled?: boolean;
  onChange: (institute: InstituteOption) => void;
  options: InstituteOption[];
  value: InstituteOption | null;
};

export function InstituteSelectField({
  disabled = false,
  onChange,
  options,
  value,
}: InstituteSelectFieldProps) {
  const { styles } = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);

  const close = () => setIsOpen(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Institute</Text>

      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.field,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
        ]}
      >
        <Text style={value ? styles.value : styles.placeholder} numberOfLines={1}>
          {value ? `${value.short_name} · ${value.name}` : 'Select your institute'}
        </Text>
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={close}
        transparent
        visible={isOpen}
      >
        <View style={[styles.modalRoot, { paddingTop: insets.top }]}>
          <Pressable
            accessibilityLabel="Close institute picker"
            onPress={close}
            style={StyleSheet.absoluteFill}
          />

          <View
            style={[
              styles.sheet,
              {
                paddingBottom: spacing.lg + insets.bottom,
                paddingLeft: spacing.lg + insets.left,
                paddingRight: spacing.lg + insets.right,
              },
            ]}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetEyebrow}>YOUR CAMPUS</Text>
            <Text style={styles.sheetTitle}>Choose your institute</Text>
            <Text style={styles.sheetSubtitle}>
              Your institute determines the campus community you join.
            </Text>

            <FlatList
              data={options}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = item.id === value?.id;

                return (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      onChange(item);
                      close();
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      isSelected && styles.optionSelected,
                      pressed && styles.optionPressed,
                    ]}
                  >
                    <View style={styles.optionCopy}>
                      <Text style={styles.optionShortName}>{item.short_name}</Text>
                      <Text style={styles.optionName}>{item.name}</Text>
                    </View>
                    {isSelected ? <Text style={styles.check}>✓</Text> : null}
                  </Pressable>
                );
              }}
              showsVerticalScrollIndicator={false}
              style={styles.list}
            />

            <Pressable
              accessibilityRole="button"
              onPress={close}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.closeButtonPressed,
              ]}
            >
              <Text style={styles.closeLabel}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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

  field: {
    minHeight: 54,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },

  value: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
  },

  placeholder: {
    flex: 1,
    fontSize: 16,
    color: colors.textMuted,
  },

  chevron: {
    marginLeft: spacing.sm,
    fontSize: 20,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  disabled: {
    opacity: 0.55,
  },

  pressed: {
    borderColor: colors.textSecondary,
  },

  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },

  sheet: {
    maxHeight: '78%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.background,
  },

  sheetHandle: {
    width: 40,
    height: 4,
    marginBottom: spacing.lg,
    borderRadius: radius.full,
    alignSelf: 'center',
    backgroundColor: colors.border,
  },

  sheetEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: colors.textMuted,
  },

  sheetTitle: {
    marginTop: spacing.sm,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },

  sheetSubtitle: {
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  list: {
    marginTop: spacing.lg,
  },

  option: {
    minHeight: 72,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },

  optionSelected: {
    borderColor: colors.textPrimary,
  },

  optionPressed: {
    opacity: 0.7,
  },

  optionCopy: {
    flex: 1,
  },

  optionShortName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  optionName: {
    marginTop: spacing.xs,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  check: {
    marginLeft: spacing.md,
    fontSize: 18,
    fontWeight: '700',
    color: colors.success,
  },

  closeButton: {
    minHeight: 50,
    marginTop: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  closeButtonPressed: {
    backgroundColor: colors.borderSubtle,
  },

  closeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
