import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing, type ThemeColors } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useTheme';
import type { AccountModeration } from '../../lib/accountModeration';
import { supabase } from '../../lib/supabase';

type NoticeProps = {
  moderation: AccountModeration;
};

const TITLES = {
  banned: 'Account banned',
  restricted: 'Account restricted',
  suspended: 'Account suspended',
  warned: 'Account warning',
} as const;

function expiryText(expiresAt: string | null) {
  return expiresAt
    ? `This action ends ${new Date(expiresAt).toLocaleString()}.`
    : null;
}

export function AccountModerationBanner({ moderation }: NoticeProps) {
  const { styles } = useThemedStyles(createStyles);

  if (moderation.status !== 'warned' && moderation.status !== 'restricted') {
    return null;
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.bannerSafeArea}>
      <View accessibilityRole="alert" style={styles.banner}>
        <Text style={styles.bannerTitle}>{TITLES[moderation.status]}</Text>
        <Text style={styles.bannerText}>{moderation.userMessage}</Text>
        {moderation.expiresAt ? (
          <Text style={styles.bannerText}>{expiryText(moderation.expiresAt)}</Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

export function AccountModerationGate({ moderation }: NoticeProps) {
  const { styles } = useThemedStyles(createStyles);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (moderation.status !== 'suspended' && moderation.status !== 'banned') {
    return null;
  }

  const signOut = async () => {
    setErrorMessage(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setErrorMessage('We could not sign you out. Check your connection and try again.');
    }
  };

  const contactSupport = async () => {
    setErrorMessage(null);
    try {
      await Linking.openURL(
        'mailto:kemisto17@gmail.com?subject=Varta%20account%20moderation%20appeal'
      );
    } catch {
      setErrorMessage('Email support at kemisto17@gmail.com.');
    }
  };

  return (
    <SafeAreaView style={styles.gate}>
      <Text style={styles.gateTitle}>{TITLES[moderation.status]}</Text>
      <Text accessibilityRole="alert" style={styles.gateText}>
        {moderation.userMessage}
      </Text>
      {moderation.expiresAt ? (
        <Text style={styles.gateText}>{expiryText(moderation.expiresAt)}</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => void contactSupport()}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
      >
        <Text style={styles.primaryButtonText}>Contact support</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => void signOut()}
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
      >
        <Text style={styles.secondaryButtonText}>Sign out</Text>
      </Pressable>
      {errorMessage ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {errorMessage}
        </Text>
      ) : null}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    bannerSafeArea: {
      backgroundColor: colors.dangerSoft,
    },
    banner: {
      gap: spacing.xs,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    bannerTitle: {
      color: colors.danger,
      fontSize: 14,
      fontWeight: '700',
    },
    bannerText: {
      color: colors.textPrimary,
      fontSize: 13,
      lineHeight: 18,
    },
    gate: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      padding: spacing.xl,
      backgroundColor: colors.background,
    },
    gateTitle: {
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: '700',
      textAlign: 'center',
    },
    gateText: {
      maxWidth: 420,
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
    },
    primaryButton: {
      minHeight: 48,
      minWidth: 180,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: colors.primaryActionBackground,
    },
    primaryButtonText: {
      color: colors.primaryActionForeground,
      fontSize: 15,
      fontWeight: '700',
    },
    secondaryButton: {
      minHeight: 48,
      minWidth: 180,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
    },
    secondaryButtonText: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '600',
    },
    pressed: {
      opacity: 0.72,
    },
    errorText: {
      color: colors.danger,
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
    },
  });
