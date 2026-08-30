import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AuthField } from '../components/auth/AuthField';
import { AuthScaffold } from '../components/auth/AuthScaffold';
import { PrimaryButton } from '../components/auth/PrimaryButton';
import { spacing, type ThemeColors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useTheme';
import {
  beginPasswordRecoverySession,
  clearPendingPasswordRecoverySession,
  getAuthErrorMessage,
} from '../lib/auth';
import { supabase } from '../lib/supabase';

type RecoveryStatus = 'checking' | 'ready' | 'error' | 'success';

const INVALID_LINK_MESSAGE =
  'This password reset link is invalid or has expired. Request a new link and try again.';

function getRecoveryParameters(url: string) {
  const parameters = new URLSearchParams();
  const queryStart = url.indexOf('?');
  const fragmentStart = url.indexOf('#');

  const query = queryStart >= 0
    ? url.slice(
        queryStart + 1,
        fragmentStart >= 0 ? fragmentStart : url.length
      )
    : '';
  const fragment = fragmentStart >= 0 ? url.slice(fragmentStart + 1) : '';

  for (const encodedParameters of [query, fragment]) {
    const nextParameters = new URLSearchParams(encodedParameters);

    nextParameters.forEach((value, key) => {
      parameters.set(key, value);
    });
  }

  return parameters;
}

function isResetPasswordUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    const route = [parsedUrl.hostname, parsedUrl.pathname]
      .filter(Boolean)
      .join('/')
      .replace(/^\/+|\/+$/g, '');

    return parsedUrl.protocol === 'varta:' && route === 'reset-password';
  } catch {
    return false;
  }
}

async function clearRecoverySession(scope: 'global' | 'local' = 'global') {
  let sessionWasCleared = false;

  try {
    const { error } = scope === 'local'
      ? await supabase.auth.signOut({ scope: 'local' })
      : await supabase.auth.signOut();

    sessionWasCleared = !error;

    if (error && scope === 'global') {
      const { error: localError } = await supabase.auth.signOut({
        scope: 'local',
      });

      sessionWasCleared = !localError;
    }
  } catch {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      sessionWasCleared = !error;
    } catch {
      sessionWasCleared = false;
    }
  }

  if (sessionWasCleared) {
    clearPendingPasswordRecoverySession();
  }
}

export default function ResetPasswordScreen() {
  const recoveryUrl = Linking.useLinkingURL();
  const router = useRouter();
  const { colors, styles } = useThemedStyles(createStyles);
  const [status, setStatus] = useState<RecoveryStatus>('checking');
  const [newPassword, setNewPassword] = useState('');
  const [confirmedPassword, setConfirmedPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const processedUrlRef = useRef<string | null>(null);
  const submitPendingRef = useRef(false);

  useEffect(() => {
    if (!recoveryUrl) {
      const missingLinkTimer = setTimeout(() => {
        setErrorMessage(
          'Open the password reset link from your email to continue.'
        );
        setStatus('error');
      }, 750);

      return () => {
        clearTimeout(missingLinkTimer);
      };
    }

    if (processedUrlRef.current === recoveryUrl) {
      return;
    }

    processedUrlRef.current = recoveryUrl;
    let isActive = true;

    const establishRecoverySession = async () => {
      setStatus('checking');
      setErrorMessage(null);

      if (!isResetPasswordUrl(recoveryUrl)) {
        if (isActive) {
          setErrorMessage(INVALID_LINK_MESSAGE);
          setStatus('error');
        }
        return;
      }

      const parameters = getRecoveryParameters(recoveryUrl);
      const linkError = parameters.get('error') ?? parameters.get('error_code');
      const recoveryType = parameters.get('type');
      const accessToken = parameters.get('access_token');
      const refreshToken = parameters.get('refresh_token');

      if (
        linkError ||
        recoveryType !== 'recovery' ||
        !accessToken ||
        !refreshToken
      ) {
        if (isActive) {
          setErrorMessage(INVALID_LINK_MESSAGE);
          setStatus('error');
        }
        return;
      }

      if (!beginPasswordRecoverySession()) {
        if (isActive) {
          setErrorMessage(
            'We could not securely start password recovery. Close Varta and try the link again.'
          );
          setStatus('error');
        }
        return;
      }

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!isActive) {
          return;
        }

        if (error || !session) {
          clearPendingPasswordRecoverySession();
          setErrorMessage(INVALID_LINK_MESSAGE);
          setStatus('error');
          return;
        }

        setStatus('ready');
      } catch {
        clearPendingPasswordRecoverySession();

        if (isActive) {
          setErrorMessage(INVALID_LINK_MESSAGE);
          setStatus('error');
        }
      }
    };

    void establishRecoverySession();

    return () => {
      isActive = false;
    };
  }, [recoveryUrl]);

  const handleUpdatePassword = async () => {
    if (submitPendingRef.current) {
      return;
    }

    setErrorMessage(null);

    if (newPassword.length < 8) {
      setErrorMessage('Use at least 8 characters for your password.');
      return;
    }

    if (newPassword !== confirmedPassword) {
      setErrorMessage('The passwords do not match.');
      return;
    }

    submitPendingRef.current = true;
    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        submitPendingRef.current = false;
        setErrorMessage(getAuthErrorMessage(error.message));
        setIsSubmitting(false);
        return;
      }

      await clearRecoverySession();

      setNewPassword('');
      setConfirmedPassword('');
      setIsSubmitting(false);
      setStatus('success');
    } catch {
      submitPendingRef.current = false;
      setErrorMessage(
        'We could not update your password. Check your connection and try again.'
      );
      setIsSubmitting(false);
    }
  };

  const leaveRecoveryFlow = async (
    destination: '/(auth)/forgot-password' | '/(auth)/login'
  ) => {
    setIsLeaving(true);
    await clearRecoverySession('local');
    router.replace(destination);
  };

  if (status === 'checking') {
    return (
      <AuthScaffold showBack={false}>
        <View style={styles.stateContainer}>
          <ActivityIndicator color={colors.textPrimary} />
          <Text style={styles.stateMessage}>Checking your reset link…</Text>
        </View>
      </AuthScaffold>
    );
  }

  if (status === 'error') {
    return (
      <AuthScaffold showBack={false}>
        <Text style={styles.errorEyebrow}>LINK UNAVAILABLE</Text>
        <Text style={styles.title}>This link cannot be used.</Text>
        <Text accessibilityRole="alert" style={styles.subtitle}>
          {errorMessage}
        </Text>

        <View style={styles.singleAction}>
          <PrimaryButton
            isLoading={isLeaving}
            label="Request a new link"
            onPress={() => leaveRecoveryFlow('/(auth)/forgot-password')}
          />
        </View>
      </AuthScaffold>
    );
  }

  if (status === 'success') {
    return (
      <AuthScaffold showBack={false}>
        <Text style={styles.successEyebrow}>PASSWORD UPDATED</Text>
        <Text style={styles.title}>You are all set.</Text>
        <Text accessibilityRole="alert" style={styles.subtitle}>
          Your password has been changed. Sign in again with your new password.
        </Text>

        <View style={styles.singleAction}>
          <PrimaryButton
            isLoading={isLeaving}
            label="Return to sign in"
            onPress={() => leaveRecoveryFlow('/(auth)/login')}
          />
        </View>
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold showBack={false}>
      <Text style={styles.title}>Choose a new password.</Text>
      <Text style={styles.subtitle}>
        Use at least 8 characters. You will sign in again after changing it.
      </Text>

      <View style={styles.form}>
        <AuthField
          autoCapitalize="none"
          autoComplete="new-password"
          label="New password"
          onChangeText={setNewPassword}
          placeholder="At least 8 characters"
          returnKeyType="next"
          secureTextEntry
          textContentType="newPassword"
          value={newPassword}
        />

        <AuthField
          autoCapitalize="none"
          autoComplete="new-password"
          label="Confirm new password"
          onChangeText={setConfirmedPassword}
          onSubmitEditing={handleUpdatePassword}
          placeholder="Repeat your new password"
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
          label="Update password"
          onPress={handleUpdatePassword}
        />
      </View>
    </AuthScaffold>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  stateContainer: {
    flex: 1,
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },

  stateMessage: {
    fontSize: 14,
    color: colors.textSecondary,
  },

  errorEyebrow: {
    marginBottom: spacing.md,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: colors.danger,
  },

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

  singleAction: {
    marginTop: spacing.xl,
  },

  errorMessage: {
    marginTop: -spacing.sm,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
  },
});
