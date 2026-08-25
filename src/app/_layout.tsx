import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, spacing } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { useVerification } from '../hooks/useVerification';
import { AuthProvider } from '../providers/AuthProvider';
import { NotificationsProvider } from '../providers/NotificationsProvider';
import { ProfileProvider } from '../providers/ProfileProvider';
import { VerificationProvider } from '../providers/VerificationProvider';

function AppNavigator() {
  const { isLoading, session } = useAuth();
  const {
    errorMessage: profileErrorMessage,
    refreshProfile,
    status: profileStatus,
  } = useProfile();
  const {
    errorMessage: verificationErrorMessage,
    refreshVerification,
    status: verificationStatus,
  } = useVerification();
  const isAuthenticated = session !== null;
  const isProfileLoading =
    isAuthenticated &&
    (profileStatus === 'idle' || profileStatus === 'loading');
  const isVerificationLoading =
    isAuthenticated &&
    profileStatus === 'ready' &&
    (verificationStatus === 'idle' || verificationStatus === 'loading');

  if (isLoading || isProfileLoading || isVerificationLoading) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.brand}>VĀRTĀ</Text>
        <ActivityIndicator
          color={colors.textPrimary}
          style={styles.loadingIndicator}
        />
      </View>
    );
  }

  if (isAuthenticated && profileStatus === 'error') {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.brand}>VĀRTĀ</Text>
        <Text accessibilityRole="alert" style={styles.loadError}>
          {profileErrorMessage}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={refreshProfile}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.retryButtonPressed,
          ]}
        >
          <Text style={styles.retryLabel}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (
    isAuthenticated &&
    profileStatus === 'ready' &&
    verificationStatus === 'error'
  ) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.brand}>VĀRTĀ</Text>
        <Text accessibilityRole="alert" style={styles.loadError}>
          {verificationErrorMessage}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={refreshVerification}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.retryButtonPressed,
          ]}
        >
          <Text style={styles.retryLabel}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const needsProfile = isAuthenticated && profileStatus === 'missing';
  const needsVerificationFlow =
    isAuthenticated &&
    profileStatus === 'ready' &&
    (verificationStatus === 'missing' ||
      verificationStatus === 'pending' ||
      verificationStatus === 'rejected');
  const canAccessTabs =
    isAuthenticated &&
    profileStatus === 'ready' &&
    verificationStatus === 'verified';

  return (
    <>
      <StatusBar style="dark" />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>

        <Stack.Protected guard={needsProfile || needsVerificationFlow}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>

        <Stack.Protected guard={canAccessTabs}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="edit-profile" />
          <Stack.Screen name="feedback" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="post/[id]" />
          <Stack.Screen name="user/[id]" />
          <Stack.Screen name="events" />
          <Stack.Screen name="event/[id]" />
          <Stack.Screen name="event/[id]/edit" />
          <Stack.Screen name="organization/[id]" />
          <Stack.Screen name="organization/[id]/manage" />
          <Stack.Screen name="organization/[id]/create-event" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <VerificationProvider>
          <NotificationsProvider>
            <AppNavigator />
          </NotificationsProvider>
        </VerificationProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },

  brand: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 4,
    color: colors.textPrimary,
  },

  loadingIndicator: {
    marginTop: spacing.lg,
  },

  loadError: {
    maxWidth: 300,
    marginTop: spacing.lg,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },

  retryButton: {
    minWidth: 132,
    minHeight: 48,
    marginTop: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.textPrimary,
  },

  retryButtonPressed: {
    opacity: 0.78,
  },

  retryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
});
