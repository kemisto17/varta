import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '../components/auth/PrimaryButton';
import { SafeAreaScreen } from '../components/SafeAreaScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { spacing, type ThemeColors } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useThemedStyles } from '../hooks/useTheme';
import { normalizeEmail, requestPasswordRecovery } from '../lib/auth';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { styles } = useThemedStyles(createStyles);
  const email = session?.user.email
    ? normalizeEmail(session.user.email)
    : undefined;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);
  const submitPendingRef = useRef(false);

  const handleSendResetLink = async () => {
    if (submitPendingRef.current || !email) {
      return;
    }

    submitPendingRef.current = true;
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const { error } = await requestPasswordRecovery(email);

      if (error) {
        setErrorMessage(
          'We could not send a reset link. Please wait a moment and try again.'
        );
        return;
      }

      setSentToEmail(email);
    } catch {
      setErrorMessage(
        'We could not send a reset link. Check your connection and try again.'
      );
    } finally {
      submitPendingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaScreen style={styles.safeArea}>
      <ScreenHeader title="Reset password" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.state}>
          <Text style={styles.title}>
            {sentToEmail ? 'Check your inbox.' : 'Reset your password.'}
          </Text>
          <Text
            accessibilityRole={sentToEmail ? 'alert' : undefined}
            style={styles.subtitle}
          >
            {sentToEmail
              ? `We sent a reset link to ${sentToEmail}. Open it on this device to choose a new password.`
              : email
                ? `We will send a secure reset link to ${email}. Open it on this device to choose a new password.`
                : 'This account does not have an email address available for password recovery.'}
          </Text>

          {errorMessage ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {errorMessage}
            </Text>
          ) : null}

          <PrimaryButton
            disabled={!email}
            isLoading={isSubmitting}
            label={sentToEmail ? 'Done' : 'Send reset link'}
            onPress={sentToEmail ? () => router.back() : handleSendResetLink}
          />
        </View>
      </ScrollView>
    </SafeAreaScreen>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flexGrow: 1,
      padding: spacing.lg,
    },
    state: {
      flex: 1,
      justifyContent: 'center',
      gap: spacing.lg,
    },
    title: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '700',
      letterSpacing: -0.5,
      color: colors.textPrimary,
    },
    subtitle: {
      marginTop: -spacing.sm,
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
    },
    error: {
      marginTop: -spacing.sm,
      fontSize: 13,
      lineHeight: 19,
      color: colors.danger,
    },
  });
