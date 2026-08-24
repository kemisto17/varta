import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../../constants/theme';

export type ActionSheetAction = {
  closeOnPress?: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
};

type ActionSheetProps = {
  actions: ActionSheetAction[];
  message?: string | null;
  onClose: () => void;
  title: string;
  visible: boolean;
};

export function ActionSheet({
  actions,
  message,
  onClose,
  title,
  visible,
}: ActionSheetProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Close options"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />

        <View accessibilityViewIsModal style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={styles.actions}>
            {actions.map((action) => (
              <Pressable
                accessibilityRole="button"
                disabled={action.disabled}
                key={action.label}
                onPress={() => {
                  if (action.closeOnPress !== false) {
                    onClose();
                  }

                  action.onPress();
                }}
                style={({ pressed }) => [
                  styles.action,
                  action.disabled && styles.actionDisabled,
                  pressed && !action.disabled && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.actionText,
                    action.tone === 'danger' && styles.dangerText,
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17, 17, 17, 0.34)',
  },

  sheet: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.surface,
  },

  handle: {
    width: 36,
    height: 4,
    alignSelf: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },

  title: {
    marginTop: spacing.lg,
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  message: {
    marginTop: spacing.sm,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  actions: {
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },

  action: {
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    justifyContent: 'center',
  },

  actionText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  dangerText: {
    color: colors.danger,
  },

  actionDisabled: {
    opacity: 0.45,
  },

  cancelButton: {
    minHeight: 48,
    marginTop: spacing.md,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },

  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },

  pressed: {
    opacity: 0.58,
  },
});
