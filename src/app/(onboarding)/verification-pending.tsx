import { useThemedStyles } from '../../hooks/useTheme';
import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '../../components/auth/PrimaryButton';
import { radius, spacing, type ThemeColors } from '../../constants/theme';
import { useProfile } from '../../hooks/useProfile';
import { useVerification } from '../../hooks/useVerification';
import { supabase } from '../../lib/supabase';

export default function VerificationPendingScreen() {
  const { styles } = useThemedStyles(createStyles);
  const { profile } = useProfile();
  const { refreshVerification } = useVerification();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setErrorMessage(null);

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
            <View style={styles.statusDot} />
          </View>

          <Text style={styles.eyebrow}>SUBMISSION RECEIVED</Text>
          <Text style={styles.title}>Verification pending.</Text>
          <Text style={styles.subtitle}>
            We’re checking your student status
            {profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}.
            You’ll get access to Varta once your account is approved.
          </Text>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>CURRENT STATUS</Text>
            <View style={styles.pendingPill}>
              <View style={styles.pendingDot} />
              <Text style={styles.pendingText}>PENDING</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.statusTitle}>Nothing else needed right now.</Text>
          <Text style={styles.statusDescription}>
            Your enrollment number and private ID document are waiting for review.
            Reopen the app later or check again below.
          </Text>
        </View>

        {errorMessage ? (
          <Text accessibilityRole="alert" style={styles.errorMessage}>
            {errorMessage}
          </Text>
        ) : null}

        <View style={styles.footer}>
          <PrimaryButton
            label="Check approval status"
            onPress={refreshVerification}
          />

          <Pressable
            accessibilityRole="button"
            disabled={isSigningOut}
            onPress={handleSignOut}
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.signOutPressed,
            ]}
          >
            <Text style={styles.signOutLabel}>
              {isSigningOut ? 'Signing out…' : 'Sign out for testing'}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
    borderColor: colors.border,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },

  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.textPrimary,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: colors.success,
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

  statusCard: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  statusLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.textMuted,
  },

  pendingPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
  },

  pendingDot: {
    width: 6,
    height: 6,
    marginRight: 6,
    borderRadius: 3,
    backgroundColor: colors.textPrimary,
  },

  pendingText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textPrimary,
  },

  divider: {
    height: 1,
    marginVertical: spacing.md,
    backgroundColor: colors.borderSubtle,
  },

  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  statusDescription: {
    marginTop: spacing.sm,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
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
