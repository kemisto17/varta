import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ScreenHeader } from '../components/ScreenHeader';
import { SettingsRow } from '../components/settings/SettingsRow';
import { SettingsSection } from '../components/settings/SettingsSection';
import { SettingsToggleRow } from '../components/settings/SettingsToggleRow';
import { ThemeSelector } from '../components/settings/ThemeSelector';
import { spacing, type ThemeColors } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useTheme, useThemedStyles } from '../hooks/useTheme';
import { useVerification } from '../hooks/useVerification';
import { getAuthErrorMessage } from '../lib/auth';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  getNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferences,
} from '../lib/notificationPreferences';
import { deleteCurrentPushToken } from '../lib/pushNotifications';
import { supabase } from '../lib/supabase';

type PreferenceKey = keyof NotificationPreferences;

export default function SettingsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { status: verificationStatus } = useVerification();
  const { preference, setPreference } = useTheme();
  const { colors, styles } = useThemedStyles(createStyles);
  const userId = session?.user.id ?? null;
  const [notificationPreferences, setNotificationPreferences] = useState(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
  const [notificationError, setNotificationError] = useState<string | null>(
    null
  );
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsSaving, setNotificationsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const loadNotificationPreferences = useCallback(async () => {
    if (!userId) {
      setNotificationsLoading(false);
      return;
    }

    setNotificationsLoading(true);
    setNotificationError(null);

    try {
      setNotificationPreferences(await getNotificationPreferences(userId));
    } catch (error) {
      console.warn('[settings] Could not load notification preferences.', error);
      setNotificationError('Notification preferences could not be loaded.');
    } finally {
      setNotificationsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadNotificationPreferences();
  }, [loadNotificationPreferences]);

  const updateNotificationPreference = useCallback(
    async (key: PreferenceKey, enabled: boolean) => {
      if (!userId || notificationsSaving) {
        return;
      }

      const previous = notificationPreferences;
      const next = { ...previous, [key]: enabled };
      setNotificationPreferences(next);
      setNotificationsSaving(true);
      setNotificationError(null);

      try {
        await saveNotificationPreferences(userId, next);
      } catch (error) {
        console.warn('[settings] Could not save notification preference.', error);
        setNotificationPreferences(previous);
        setNotificationError('That preference could not be saved. Try again.');
      } finally {
        setNotificationsSaving(false);
      }
    },
    [notificationPreferences, notificationsSaving, userId]
  );

  const signOut = useCallback(async () => {
    if (!userId) {
      return;
    }

    setIsSigningOut(true);

    try {
      await deleteCurrentPushToken(userId);
    } catch (error) {
      console.warn('[push] Could not remove the current device token.', error);
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      setNotificationError(getAuthErrorMessage(error.message));
      setIsSigningOut(false);
    }
  }, [userId]);

  const confirmSignOut = useCallback(() => {
    if (isSigningOut) {
      return;
    }

    Alert.alert(
      'Sign out of Varta?',
      'Your appearance preference will stay on this device.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          style: 'destructive',
          text: 'Sign out',
          onPress: () => void signOut(),
        },
      ]
    );
  }, [isSigningOut, signOut]);

  const version = Constants.expoConfig?.version ?? 'Unavailable';
  const verificationLabel =
    verificationStatus === 'verified' ? 'Verified student' : 'In progress';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="Settings" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SettingsSection
          description="System follows this device and updates when its appearance changes."
          title="Appearance"
        >
          <ThemeSelector onChange={setPreference} value={preference} />
        </SettingsSection>

        <SettingsSection title="Account">
          <SettingsRow
            label="Edit profile"
            onPress={() => router.push('/edit-profile')}
          />
          <SettingsRow
            isLast
            label="Verification status"
            value={verificationLabel}
          />
        </SettingsSection>

        <SettingsSection title="Privacy & Safety">
          <SettingsRow
            isLast
            label="Blocked users"
            onPress={() => router.push('/blocked-users')}
          />
        </SettingsSection>

        <SettingsSection
          description="These choices stop the matching in-app notification from being created. Verification updates always remain on."
          title="Notifications"
        >
          {notificationsLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.textSecondary} size="small" />
              <Text style={styles.loadingText}>Loading preferences…</Text>
            </View>
          ) : (
            <>
              <SettingsToggleRow
                disabled={notificationsSaving}
                label="Likes"
                onValueChange={(enabled) =>
                  void updateNotificationPreference('likes_enabled', enabled)
                }
                value={notificationPreferences.likes_enabled}
              />
              <SettingsToggleRow
                disabled={notificationsSaving}
                label="Comments"
                onValueChange={(enabled) =>
                  void updateNotificationPreference(
                    'comments_enabled',
                    enabled
                  )
                }
                value={notificationPreferences.comments_enabled}
              />
              <SettingsToggleRow
                disabled={notificationsSaving}
                label="Badges"
                onValueChange={(enabled) =>
                  void updateNotificationPreference('badges_enabled', enabled)
                }
                value={notificationPreferences.badges_enabled}
              />
              <SettingsToggleRow
                disabled={notificationsSaving}
                isLast
                label="Events"
                onValueChange={(enabled) =>
                  void updateNotificationPreference('events_enabled', enabled)
                }
                value={notificationPreferences.events_enabled}
              />
            </>
          )}
        </SettingsSection>

        {notificationError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {notificationError}
          </Text>
        ) : null}

        <SettingsSection title="About">
          <SettingsRow label="VĀRTĀ" value="University community" />
          <SettingsRow label="Version" value={version} />
          <SettingsRow
            isLast
            label="Send feedback"
            onPress={() => router.push('/feedback')}
          />
        </SettingsSection>

        <SettingsSection title="Session">
          <SettingsRow
            isLast
            label={isSigningOut ? 'Signing out…' : 'Sign out'}
            onPress={isSigningOut ? undefined : confirmSignOut}
            tone="danger"
          />
        </SettingsSection>

        <Text style={styles.footer}>VĀRTĀ · Built for campus conversations</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    loadingRow: {
      minHeight: 58,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    loadingText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    error: {
      marginTop: spacing.md,
      paddingHorizontal: spacing.xs,
      fontSize: 12,
      lineHeight: 18,
      color: colors.danger,
    },
    footer: {
      marginTop: spacing.xl,
      textAlign: 'center',
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1.2,
      color: colors.textMuted,
    },
  });
