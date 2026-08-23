import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radius, spacing } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { getAuthErrorMessage } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen() {
  const { session } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const email = session?.user.email ?? 'Signed-in student';
  const initial = email.charAt(0).toUpperCase();

  const handleSignOut = async () => {
    setErrorMessage(null);
    setIsSigningOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setErrorMessage(getAuthErrorMessage(error.message));
      setIsSigningOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>YOUR SPACE</Text>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>

          <View style={styles.identityCopy}>
            <Text style={styles.email} numberOfLines={1}>
              {email}
            </Text>
            <Text style={styles.placeholder}>
              Student profile setup comes next.
            </Text>
          </View>
        </View>

        {errorMessage ? (
          <Text accessibilityRole="alert" style={styles.errorMessage}>
            {errorMessage}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={isSigningOut}
          onPress={handleSignOut}
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.pressed,
            isSigningOut && styles.disabled,
          ]}
        >
          {isSigningOut ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Text style={styles.signOutText}>Sign out</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: colors.textMuted,
  },

  title: {
    marginTop: spacing.sm,
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  identityCard: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textPrimary,
  },

  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },

  identityCopy: {
    flex: 1,
    marginLeft: spacing.md,
  },

  email: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  placeholder: {
    marginTop: spacing.xs,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  errorMessage: {
    marginTop: spacing.md,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
  },

  signOutButton: {
    minHeight: 52,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },

  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  pressed: {
    opacity: 0.6,
  },

  disabled: {
    opacity: 0.65,
  },
});
