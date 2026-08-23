import { useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '../../components/auth/PrimaryButton';
import { colors, radius, spacing } from '../../constants/theme';
import { useVerification } from '../../hooks/useVerification';
import { supabase } from '../../lib/supabase';
import {
  deleteRejectedVerification,
  getVerificationResetErrorMessage,
} from '../../lib/verification';

export default function VerificationRejectedScreen() {
  const { markVerificationDeleted, verification } = useVerification();
  const [isResetting, setIsResetting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleReset = async () => {
    if (!verification) {
      return;
    }

    setIsResetting(true);
    setErrorMessage(null);

    try {
      await deleteRejectedVerification(verification);
      markVerificationDeleted();
    } catch {
      setErrorMessage(getVerificationResetErrorMessage());
      setIsResetting(false);
    }
  };

  const confirmReset = () => {
    Alert.alert(
      'Replace your submission?',
      'Your rejected verification and its private document will be removed so you can submit a new one.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: () => void handleReset(),
        },
      ]
    );
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    const { error } = await supabase.auth.signOut();

    if (error) {
      setErrorMessage('We could not sign you out. Please try again.');
      setIsSigningOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.brand}>VĀRTĀ</Text>
          <Text style={styles.headerLabel}>VERIFICATION</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.statusMark}>
            <Text style={styles.statusIcon}>!</Text>
          </View>
          <Text style={styles.eyebrow}>ACTION NEEDED</Text>
          <Text style={styles.title}>Let’s try that again.</Text>
          <Text style={styles.subtitle}>
            We couldn’t approve the previous submission. You can remove it and
            send a clearer or corrected student ID.
          </Text>
        </View>

        {verification?.rejection_reason ? (
          <View style={styles.reasonCard}>
            <Text style={styles.reasonLabel}>REVIEW NOTE</Text>
            <Text style={styles.reasonText}>
              {verification.rejection_reason}
            </Text>
          </View>
        ) : null}

        {errorMessage ? (
          <Text accessibilityRole="alert" style={styles.errorMessage}>
            {errorMessage}
          </Text>
        ) : null}

        <View style={styles.footer}>
          <PrimaryButton
            isLoading={isResetting}
            label="Upload a new student ID"
            onPress={confirmReset}
          />

          <Pressable
            accessibilityRole="button"
            disabled={isSigningOut || isResetting}
            onPress={handleSignOut}
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.signOutPressed,
            ]}
          >
            <Text style={styles.signOutLabel}>
              {isSigningOut ? 'Signing out…' : 'Sign out'}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },

  header: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  brand: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 3.2,
    color: colors.textPrimary,
  },

  headerLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: colors.textMuted,
  },

  hero: {
    marginTop: spacing.xxl,
  },

  statusMark: {
    width: 52,
    height: 52,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusIcon: {
    fontSize: 23,
    fontWeight: '700',
    color: colors.danger,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: colors.danger,
  },

  title: {
    maxWidth: 350,
    marginTop: spacing.sm,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '700',
    letterSpacing: -1,
    color: colors.textPrimary,
  },

  subtitle: {
    maxWidth: 350,
    marginTop: spacing.md,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textSecondary,
  },

  reasonCard: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },

  reasonLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.textMuted,
  },

  reasonText: {
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textPrimary,
  },

  errorMessage: {
    marginTop: spacing.lg,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
  },

  footer: {
    marginTop: 'auto',
    paddingTop: spacing.xl,
  },

  signOutButton: {
    minHeight: 50,
    marginTop: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  signOutPressed: {
    opacity: 0.5,
  },

  signOutLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
