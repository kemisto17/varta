import { useThemedStyles } from '../../hooks/useTheme';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, } from 'react-native';

import { radius, spacing, type ThemeColors } from '../../constants/theme';
import {
  createReport,
  getModerationErrorMessage,
  MAX_REPORT_DETAILS_CHARACTERS,
  REPORT_REASONS,
  type ReportReason,
  type ReportTarget,
} from '../../lib/moderation';

type ReportSheetProps = {
  onClose: () => void;
  reporterId: string | null;
  target: ReportTarget | null;
};

export function ReportSheet({
  onClose,
  reporterId,
  target,
}: ReportSheetProps) {
  const { colors, styles } = useThemedStyles(createStyles);
  const [details, setDetails] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (target) {
      setDetails('');
      setErrorMessage(null);
      setIsDuplicate(false);
      setIsSubmitting(false);
      setReason(null);
      setSubmitted(false);
    }
  }, [target]);

  const handleSubmit = async () => {
    if (!reporterId || !target || !reason || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await createReport({
        details,
        reason,
        reporterId,
        target,
      });
      setIsDuplicate(result.duplicate);
      setSubmitted(true);
    } catch (error) {
      setErrorMessage(getModerationErrorMessage(error));
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={isSubmitting ? () => undefined : onClose}
      statusBarTranslucent
      transparent
      visible={target !== null}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable
          accessibilityLabel="Close report"
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />

        <View accessibilityViewIsModal style={styles.sheet}>
          <View style={styles.handle} />

          {submitted ? (
            <View style={styles.successState}>
              <View style={styles.successIcon}>
                <SymbolView
                  name={{
                    android: 'check',
                    ios: 'checkmark',
                    web: 'check',
                  }}
                  size={24}
                  tintColor={colors.success}
                />
              </View>
              <Text style={styles.successTitle}>
                {isDuplicate ? 'Report already received' : 'Report submitted'}
              </Text>
              <Text style={styles.successMessage}>
                {isDuplicate
                  ? 'This is already in the moderation queue. You do not need to submit it again.'
                  : 'Thanks for letting us know. A moderator can now review it.'}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={onClose}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.headerRow}>
                <View style={styles.headerCopy}>
                  <Text style={styles.eyebrow}>KEEP VĀRTĀ SAFE</Text>
                  <Text style={styles.title}>{target?.label}</Text>
                </View>
                <Pressable
                  accessibilityLabel="Close report"
                  accessibilityRole="button"
                  disabled={isSubmitting}
                  hitSlop={10}
                  onPress={onClose}
                  style={({ pressed }) => [
                    styles.closeButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <SymbolView
                    name={{ android: 'close', ios: 'xmark', web: 'close' }}
                    size={19}
                    tintColor={colors.textSecondary}
                  />
                </Pressable>
              </View>

              <Text style={styles.intro}>
                Choose the reason that best describes the problem. Reports are private.
              </Text>

              <View style={styles.reasonList}>
                {REPORT_REASONS.map((option) => {
                  const isSelected = option.value === reason;

                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected }}
                      key={option.value}
                      onPress={() => setReason(option.value)}
                      style={({ pressed }) => [
                        styles.reason,
                        isSelected && styles.reasonSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.reasonCopy}>
                        <Text style={styles.reasonLabel}>{option.label}</Text>
                        <Text style={styles.reasonDescription}>
                          {option.description}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.radio,
                          isSelected && styles.radioSelected,
                        ]}
                      >
                        {isSelected ? <View style={styles.radioDot} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Anything else? (optional)</Text>
              <TextInput
                accessibilityLabel="Additional report details"
                maxLength={MAX_REPORT_DETAILS_CHARACTERS}
                multiline
                onChangeText={setDetails}
                placeholder="Add context that may help a moderator…"
                placeholderTextColor={colors.textMuted}
                style={styles.detailsInput}
                textAlignVertical="top"
                value={details}
              />
              <Text style={styles.characterCount}>
                {details.length}/{MAX_REPORT_DETAILS_CHARACTERS}
              </Text>

              {errorMessage ? (
                <Text accessibilityRole="alert" style={styles.errorMessage}>
                  {errorMessage}
                </Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={!reason || isSubmitting}
                onPress={() => void handleSubmit()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (!reason || isSubmitting) && styles.primaryButtonDisabled,
                  pressed && reason && !isSubmitting && styles.pressed,
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Submit report</Text>
                )}
              </Pressable>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },

  sheet: {
    maxHeight: '91%',
    paddingTop: spacing.sm,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },

  handle: {
    width: 36,
    height: 4,
    alignSelf: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },

  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  headerCopy: {
    flex: 1,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.25,
    color: colors.textMuted,
  },

  title: {
    marginTop: spacing.xs,
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  closeButton: {
    width: 40,
    height: 40,
    marginTop: -8,
    marginRight: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  intro: {
    marginTop: spacing.md,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  reasonList: {
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },

  reason: {
    minHeight: 64,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
  },

  reasonSelected: {
    backgroundColor: colors.background,
  },

  reasonCopy: {
    flex: 1,
    paddingRight: spacing.md,
  },

  reasonLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  reasonDescription: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  radio: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  radioSelected: {
    borderColor: colors.textPrimary,
  },

  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.textPrimary,
  },

  fieldLabel: {
    marginTop: spacing.lg,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  detailsInput: {
    minHeight: 96,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },

  characterCount: {
    marginTop: spacing.xs,
    textAlign: 'right',
    fontSize: 10,
    color: colors.textMuted,
  },

  errorMessage: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    fontSize: 12,
    lineHeight: 18,
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
  },

  primaryButton: {
    minHeight: 50,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textPrimary,
  },

  primaryButtonDisabled: {
    backgroundColor: colors.border,
  },

  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },

  successState: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },

  successIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.successSoft,
  },

  successTitle: {
    marginTop: spacing.lg,
    fontSize: 21,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  successMessage: {
    maxWidth: 310,
    marginTop: spacing.sm,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  pressed: {
    opacity: 0.6,
  },
});
