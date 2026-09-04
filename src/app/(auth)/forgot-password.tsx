import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthField } from '../../components/auth/AuthField';
import { AuthScaffold } from '../../components/auth/AuthScaffold';
import { PrimaryButton } from '../../components/auth/PrimaryButton';
import { spacing, type ThemeColors } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useTheme';
import {
  createPasswordRecoveryRedirectUrl,
  isValidEmail,
  normalizeEmail,
} from '../../lib/auth';
import { supabase } from '../../lib/supabase';

export default function ForgotPasswordScreen() {
  const { styles } = useThemedStyles(createStyles);
  const [email, setEmail] = useState('');
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitPendingRef = useRef(false);

  const handleSendResetLink = async () => {
    if (submitPendingRef.current) {
      return;
    }

    setErrorMessage(null);

    if (!isValidEmail(email)) {
      setErrorMessage('Enter a valid email address.');
      return;
    }

    const normalizedEmail = normalizeEmail(email);

    submitPendingRef.current = true;
    setIsSubmitting(true);

    try {
      const redirectTo = createPasswordRecoveryRedirectUrl();
      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo }
      );

      if (error) {
        submitPendingRef.current = false;
        setErrorMessage(
          'We could not send a reset link. Please wait a moment and try again.'
        );
        setIsSubmitting(false);
        return;
      }

      setSentToEmail(normalizedEmail);
      setIsSubmitting(false);
    } catch {
      submitPendingRef.current = false;
      setErrorMessage(
        'We could not send a reset link. Check your connection and try again.'
      );
      setIsSubmitting(false);
    }
  };

  if (sentToEmail) {
    return (
      <AuthScaffold>
        <Text style={styles.successEyebrow}>CHECK YOUR EMAIL</Text>
        <Text style={styles.title}>Your reset link is on its way.</Text>
        <Text style={styles.subtitle}>
          If an account exists for {sentToEmail}, you will receive a password
          reset email. Open its link on this device to continue in Varta.
        </Text>

        <Link href="/(auth)/login" replace style={styles.returnLink}>
          Back to sign in
        </Link>
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold>
      <Text style={styles.title}>Reset your password.</Text>
      <Text style={styles.subtitle}>
        Enter the email for your Varta account and we will send you a secure
        reset link.
      </Text>

      <View style={styles.form}>
        <AuthField
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          label="Email"
          onChangeText={setEmail}
          onSubmitEditing={handleSendResetLink}
          placeholder="you@example.com"
          returnKeyType="send"
          textContentType="emailAddress"
          value={email}
        />

        {errorMessage ? (
          <Text accessibilityRole="alert" style={styles.errorMessage}>
            {errorMessage}
          </Text>
        ) : null}

        <PrimaryButton
          isLoading={isSubmitting}
          label="Send reset link"
          onPress={handleSendResetLink}
        />
      </View>

      <Text style={styles.accountPrompt}>
        Remembered your password?{' '}
        <Link href="/(auth)/login" replace style={styles.accountLink}>
          Sign in
        </Link>
      </Text>
    </AuthScaffold>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  successEyebrow: {
    marginBottom: spacing.md,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: colors.success,
  },

  title: {
    maxWidth: 340,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: colors.textPrimary,
  },

  subtitle: {
    maxWidth: 340,
    marginTop: spacing.sm,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },

  form: {
    marginTop: spacing.xxl,
    gap: spacing.lg,
  },

  errorMessage: {
    marginTop: -spacing.sm,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
  },

  returnLink: {
    marginTop: spacing.xl,
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  accountPrompt: {
    marginTop: spacing.xl,
    textAlign: 'center',
    fontSize: 14,
    color: colors.textSecondary,
  },

  accountLink: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
