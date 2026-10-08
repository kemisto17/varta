import { useThemedStyles } from '../../hooks/useTheme';
import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthField } from '../../components/auth/AuthField';
import { AuthScaffold } from '../../components/auth/AuthScaffold';
import { PrimaryButton } from '../../components/auth/PrimaryButton';
import { spacing, type ThemeColors } from '../../constants/theme';
import {
  getAuthErrorMessage,
  isGoogleSignInEnabled,
  isValidEmail,
  normalizeEmail,
  startGoogleSignIn,
} from '../../lib/auth';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
  const { styles } = useThemedStyles(createStyles);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [googleErrorMessage, setGoogleErrorMessage] = useState<string | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const submitPendingRef = useRef(false);
  const googleSubmitPendingRef = useRef(false);

  const handleLogin = async () => {
    if (submitPendingRef.current) {
      return;
    }

    setErrorMessage(null);

    if (!isValidEmail(email)) {
      setErrorMessage('Enter a valid email address.');
      return;
    }

    if (!password) {
      setErrorMessage('Enter your password.');
      return;
    }

    submitPendingRef.current = true;
    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizeEmail(email),
        password,
      });

      if (!error) {
        return;
      }

      submitPendingRef.current = false;
      setErrorMessage(getAuthErrorMessage(error.message));
      setIsSubmitting(false);
    } catch {
      submitPendingRef.current = false;
      setErrorMessage('We could not sign you in. Check your connection and try again.');
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

  return (
    <AuthScaffold>
      <Text style={styles.title}>Welcome back.</Text>
      <Text style={styles.subtitle}>
        Sign in to return to your campus conversation.
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
          autoComplete="current-password"
          label="Password"
          onChangeText={setPassword}
          onSubmitEditing={handleLogin}
          placeholder="Your password"
          returnKeyType="done"
          rightAccessory={(
            <Pressable
              accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setIsPasswordVisible((visible) => !visible)}
            >
              <Text style={styles.passwordToggle}>
                {isPasswordVisible ? 'Hide' : 'Show'}
              </Text>
            </Pressable>
          )}
          secureTextEntry={!isPasswordVisible}
          textContentType="password"
          value={password}
        />

        <Link
          href="/(auth)/forgot-password"
          style={styles.forgotPasswordLink}
        >
          Forgot password?
        </Link>

        {errorMessage ? (
          <Text accessibilityRole="alert" style={styles.errorMessage}>
            {errorMessage}
          </Text>
        ) : null}

        <PrimaryButton
          isLoading={isSubmitting}
          label="Sign in"
          onPress={handleLogin}
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
        New to Varta?{' '}
        <Link href="/(auth)/register" replace style={styles.accountLink}>
          Create an account
        </Link>
      </Text>
    </AuthScaffold>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  title: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: colors.textPrimary,
  },

  subtitle: {
    maxWidth: 320,
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

  forgotPasswordLink: {
    marginTop: -spacing.sm,
    alignSelf: 'flex-end',
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  passwordToggle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
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
});
