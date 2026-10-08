import { useThemedStyles } from '../../hooks/useTheme';
import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthField } from '../../components/auth/AuthField';
import { PolicyLinks } from '../../components/PolicyLinks';
import { AuthScaffold } from '../../components/auth/AuthScaffold';
import { PrimaryButton } from '../../components/auth/PrimaryButton';
import { spacing, type ThemeColors } from '../../constants/theme';
import {
  getAuthErrorMessage,
  createAuthCallbackRedirectUrl,
  getPasswordPolicyMessage,
  isGoogleSignInEnabled,
  isValidEmail,
  normalizeEmail,
  startGoogleSignIn,
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
  const [googleErrorMessage, setGoogleErrorMessage] = useState<string | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const submitPendingRef = useRef(false);
  const googleSubmitPendingRef = useRef(false);

  const handleRegister = async () => {
    if (submitPendingRef.current) {
      return;
    }

    setErrorMessage(null);

    if (!isValidEmail(email)) {
      setErrorMessage('Enter a valid email address.');
      return;
    }

    const passwordPolicyMessage = getPasswordPolicyMessage(password);

    if (passwordPolicyMessage) {
      setErrorMessage(passwordPolicyMessage);
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
        options: {
          emailRedirectTo: createAuthCallbackRedirectUrl(),
        },
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

  const handleGoogleSignIn = async () => {
    if (googleSubmitPendingRef.current) {
      return;
    }

    setGoogleErrorMessage(null);
    googleSubmitPendingRef.current = true;
    setIsGoogleSubmitting(true);

    try {
      await startGoogleSignIn();
      googleSubmitPendingRef.current = false;
      setIsGoogleSubmitting(false);
    } catch (error) {
      googleSubmitPendingRef.current = false;
      setGoogleErrorMessage(
        error instanceof Error
          ? getAuthErrorMessage(error.message)
          : 'We could not start Google sign-in. Try again in a moment.'
      );
      setIsGoogleSubmitting(false);
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
          placeholder="Letters and numbers"
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

        {isGoogleSignInEnabled ? (
          <>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={isGoogleSubmitting}
              onPress={handleGoogleSignIn}
              style={({ pressed }) => [
                styles.googleButton,
                isGoogleSubmitting && styles.googleButtonDisabled,
                pressed && !isGoogleSubmitting && styles.googleButtonPressed,
              ]}
            >
              <Text style={styles.googleButtonLabel}>
                {isGoogleSubmitting ? 'Opening Google…' : 'Continue with Google'}
              </Text>
            </Pressable>

            {googleErrorMessage ? (
              <Text accessibilityRole="alert" style={styles.errorMessage}>
                {googleErrorMessage}
              </Text>
            ) : null}
          </>
        ) : null}
      </View>

      <Text style={styles.accountPrompt}>
        You will review and accept the Terms of Use after signing in.
      </Text>
      <PolicyLinks />

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

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderSubtle,
  },

  dividerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },

  googleButton: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },

  googleButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  googleButtonPressed: {
    backgroundColor: colors.borderSubtle,
  },

  googleButtonDisabled: {
    opacity: 0.55,
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
