import { useThemedStyles } from '../../hooks/useTheme';
import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthField } from '../../components/auth/AuthField';
import { AuthScaffold } from '../../components/auth/AuthScaffold';
import { PrimaryButton } from '../../components/auth/PrimaryButton';
import { spacing, type ThemeColors } from '../../constants/theme';
import {
  getAuthErrorMessage,
  isValidEmail,
  normalizeEmail,
} from '../../lib/auth';
import { supabase } from '../../lib/supabase';

export default function RegisterScreen() {
  const { styles } = useThemedStyles(createStyles);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmedPassword, setConfirmedPassword] = useState('');
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitPendingRef = useRef(false);

  const handleRegister = async () => {
    if (submitPendingRef.current) {
      return;
    }

    setErrorMessage(null);

    if (!isValidEmail(email)) {
      setErrorMessage('Enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Use at least 8 characters for your password.');
      return;
    }

    if (password !== confirmedPassword) {
      setErrorMessage('The passwords do not match.');
      return;
    }

    submitPendingRef.current = true;
    setIsSubmitting(true);

    const normalizedEmail = normalizeEmail(email);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });

      if (error) {
        submitPendingRef.current = false;
        setErrorMessage(getAuthErrorMessage(error.message));
        setIsSubmitting(false);
        return;
      }

      if (data.session) {
        return;
      }

      submitPendingRef.current = false;
      setConfirmationEmail(normalizedEmail);
      setIsSubmitting(false);
    } catch {
      submitPendingRef.current = false;
      setErrorMessage('We could not create your account. Check your connection and try again.');
      setIsSubmitting(false);
    }
  };

  if (confirmationEmail) {
    return (
      <AuthScaffold showBack={false}>
        <Text style={styles.successEyebrow}>ONE MORE STEP</Text>
        <Text style={styles.title}>Check your inbox.</Text>
        <Text style={styles.subtitle}>
          We sent a confirmation link to {confirmationEmail}. Open it to finish
          creating your Varta account.
        </Text>

        <Link href="/(auth)/login" replace style={styles.successLink}>
          Continue to sign in
        </Link>
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold>
      <Text style={styles.title}>Join the conversation.</Text>
      <Text style={styles.subtitle}>
        Create your account to see what is happening around campus.
      </Text>

      <View style={styles.form}>
        <AuthField
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          label="Email"
          onChangeText={setEmail}
          placeholder="you@example.com"
          returnKeyType="next"
          textContentType="emailAddress"
          value={email}
        />

        <AuthField
          autoCapitalize="none"
          autoComplete="new-password"
          label="Password"
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          returnKeyType="next"
          secureTextEntry
          textContentType="newPassword"
          value={password}
        />

        <AuthField
          autoCapitalize="none"
          autoComplete="new-password"
          label="Confirm password"
          onChangeText={setConfirmedPassword}
          onSubmitEditing={handleRegister}
          placeholder="Repeat your password"
          returnKeyType="done"
          secureTextEntry
          textContentType="newPassword"
          value={confirmedPassword}
        />

        {errorMessage ? (
          <Text accessibilityRole="alert" style={styles.errorMessage}>
            {errorMessage}
          </Text>
        ) : null}

        <PrimaryButton
          isLoading={isSubmitting}
          label="Create account"
          onPress={handleRegister}
        />
      </View>

      <Text style={styles.accountPrompt}>
        Already have an account?{' '}
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
    marginTop: spacing.xl,
    gap: spacing.md,
  },

  errorMessage: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
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

  successLink: {
    marginTop: spacing.xl,
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
