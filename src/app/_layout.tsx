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
import { AuthProvider } from '../providers/AuthProvider';
import { ProfileProvider } from '../providers/ProfileProvider';

function AppNavigator() {
  const { isLoading, session } = useAuth();
  const {
    errorMessage,
    refreshProfile,
    shouldShowVerificationPending,
    status: profileStatus,
  } = useProfile();
  const isAuthenticated = session !== null;
  const isProfileLoading =
    isAuthenticated &&
    (profileStatus === 'idle' || profileStatus === 'loading');

  if (isLoading || isProfileLoading) {
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
          {errorMessage}
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

  const needsProfile = isAuthenticated && profileStatus === 'missing';
  const isVerificationHandoff =
    isAuthenticated &&
    profileStatus === 'ready' &&
    shouldShowVerificationPending;
  const canAccessTabs =
    isAuthenticated &&
    profileStatus === 'ready' &&
    !shouldShowVerificationPending;

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

        <Stack.Protected guard={isAuthenticated}>
          <Stack.Protected guard={needsProfile || isVerificationHandoff}>
            <Stack.Screen name="(onboarding)" />
          </Stack.Protected>
        </Stack.Protected>

        <Stack.Protected guard={canAccessTabs}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <AppNavigator />
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
