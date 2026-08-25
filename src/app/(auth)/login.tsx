import { useThemedStyles } from '../../hooks/useTheme';
import { Link } from 'expo-router';
import { useState } from 'react';
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

export default function LoginScreen() {
  const { styles } = useThemedStyles(createStyles);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    setErrorMessage(null);

    if (!isValidEmail(email)) {
      setErrorMessage('Enter a valid email address.');
      return;
    }

    if (!password) {
      setErrorMessage('Enter your password.');
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });

    if (error) {
      setErrorMessage(getAuthErrorMessage(error.message));
      setIsSubmitting(false);
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
          secureTextEntry
          textContentType="password"
          value={password}
        />

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
