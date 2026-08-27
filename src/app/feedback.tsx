import { useThemedStyles } from '../hooks/useTheme';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, } from 'react-native';

import { SafeAreaScreen } from '../components/SafeAreaScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { radius, spacing, type ThemeColors } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import {
  FEEDBACK_CATEGORIES,
  type FeedbackCategory,
  getFeedbackErrorMessage,
  MAX_FEEDBACK_CHARACTERS,
  submitFeedback,
} from '../lib/feedback';

export default function FeedbackScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const router = useRouter();
  const { session } = useAuth();
  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const submitPendingRef = useRef(false);

  const handleSubmit = async () => {
    const userId = session?.user.id;

    if (!userId || submitPendingRef.current) {
      return;
    }

    submitPendingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await submitFeedback({ category, message, userId });
      setSubmitted(true);
    } catch (error) {
      console.warn('[feedback] Could not submit feedback.', error);
      setErrorMessage(getFeedbackErrorMessage(error));
    } finally {
      submitPendingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <SafeAreaScreen style={styles.safeArea}>
        <ScreenHeader title="Feedback" />
        <View style={styles.successState}>
          <View style={styles.successIcon}>
            <SymbolView
              name={{ android: 'check', ios: 'checkmark', web: 'check' }}
              size={25}
              tintColor={colors.success}
            />
          </View>
          <Text style={styles.successTitle}>Thank you.</Text>
          <Text style={styles.successMessage}>
            Your note is in the private alpha feedback queue.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.doneButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaScreen>
    );
  }

  return (
    <SafeAreaScreen style={styles.safeArea}>
      <ScreenHeader title="Feedback" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.eyebrow}>INTERNAL ALPHA</Text>
          <Text style={styles.heading}>Help shape Varta.</Text>
          <Text style={styles.intro}>
            Tell us what broke, felt confusing, or would make campus life more
            useful. Only the Varta team can read this feedback.
          </Text>

          <Text style={styles.label}>Category</Text>
          <View style={styles.categories}>
            {FEEDBACK_CATEGORIES.map((item) => (
              <Pressable
                accessibilityRole="button"
                key={item.value}
                onPress={() => setCategory(item.value)}
                style={({ pressed }) => [
                  styles.category,
                  category === item.value && styles.categoryActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    category === item.value && styles.categoryTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.messageHeading}>
            <Text style={styles.label}>What should we know?</Text>
            <Text style={styles.counter}>
              {message.length}/{MAX_FEEDBACK_CHARACTERS.toLocaleString()}
            </Text>
          </View>
          <TextInput
            accessibilityLabel="Feedback message"
            maxLength={MAX_FEEDBACK_CHARACTERS}
            multiline
            onChangeText={setMessage}
            placeholder="Describe what happened and what you expected…"
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.textPrimary}
            style={styles.messageInput}
            textAlignVertical="top"
            value={message}
          />

          {errorMessage ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {errorMessage}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => void handleSubmit()}
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.pressed,
              isSubmitting && styles.disabled,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.submitButtonText}>Send feedback</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaScreen>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  eyebrow: {
    marginTop: spacing.sm,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: colors.textMuted,
  },
  heading: {
    marginTop: spacing.sm,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: colors.textPrimary,
  },
  intro: {
    maxWidth: 340,
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  label: {
    marginTop: spacing.xl,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  categories: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  category: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  categoryActive: {
    borderColor: colors.textPrimary,
    backgroundColor: colors.textPrimary,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  categoryTextActive: { color: colors.white },
  messageHeading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  counter: {
    marginBottom: 1,
    fontSize: 11,
    color: colors.textMuted,
  },
  messageInput: {
    minHeight: 176,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  error: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    fontSize: 12,
    lineHeight: 18,
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  submitButton: {
    minHeight: 52,
    marginTop: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.textPrimary,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  successState: {
    flex: 1,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.successSoft,
  },
  successTitle: {
    marginTop: spacing.lg,
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  successMessage: {
    maxWidth: 280,
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  doneButton: {
    minWidth: 150,
    minHeight: 48,
    marginTop: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.textPrimary,
  },
  doneButtonText: { fontSize: 13, fontWeight: '700', color: colors.white },
  pressed: { opacity: 0.58 },
  disabled: { opacity: 0.55 },
});
