import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import { useThemedStyles } from '../../hooks/useTheme';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, type ThemeColors } from '../../constants/theme';
import { formatDateInput, formatTimeInput } from '../../lib/time';

type EventDateTimeFieldProps = {
  label: string;
  maximumDate?: Date;
  mode: 'date' | 'time';
  onChange: (date: Date) => void;
  value: Date;
};

export function EventDateTimeField({
  label,
  maximumDate,
  mode,
  onChange,
  value,
}: EventDateTimeFieldProps) {
  const { colors, resolvedTheme, styles } = useThemedStyles(createStyles);
  const [isOpen, setIsOpen] = useState(false);

  const handleValueChange = (
    _event: DateTimePickerChangeEvent,
    selected: Date
  ) => {
    if (Platform.OS !== 'ios') {
      setIsOpen(false);
    }

    onChange(selected);
  };

  const handleDismiss = () => {
    if (Platform.OS !== 'ios') {
      setIsOpen(false);
    }
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [styles.control, pressed && styles.pressed]}
      >
        <Text style={styles.value}>
          {mode === 'date' ? formatDateInput(value) : formatTimeInput(value)}
        </Text>
      </Pressable>
      {isOpen ? (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            accentColor={colors.textPrimary}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={maximumDate}
            mode={mode}
            onDismiss={handleDismiss}
            onValueChange={handleValueChange}
            textColor={colors.textPrimary}
            themeVariant={resolvedTheme}
            value={value}
          />
          {Platform.OS === 'ios' ? (
            <Pressable accessibilityRole="button" onPress={() => setIsOpen(false)} style={styles.doneButton}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  field: { flex: 1 },
  label: { marginBottom: spacing.sm, fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  control: { minHeight: 50, paddingHorizontal: spacing.md, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  value: { fontSize: 15, color: colors.textPrimary },
  pickerWrap: { marginTop: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface },
  doneButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  doneText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  pressed: { opacity: 0.55 },
});
