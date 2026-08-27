import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
  Stack,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from 'react-native-safe-area-context';

import { SafeAreaScreen } from '../components/SafeAreaScreen';
import { spacing, type ThemeColors } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { useTheme, useThemedStyles } from '../hooks/useTheme';
import { useVerification } from '../hooks/useVerification';
import { AuthProvider } from '../providers/AuthProvider';
import { FeedProvider } from '../providers/FeedProvider';
import { NotificationsProvider } from '../providers/NotificationsProvider';
import { ProfileProvider } from '../providers/ProfileProvider';
import { ThemeProvider } from '../providers/ThemeProvider';
import { VerificationProvider } from '../providers/VerificationProvider';

void SplashScreen.preventAutoHideAsync();

function AppNavigator() {
  const {
    colors,
    resolvedTheme,
    styles,
  } = useThemedStyles(
    createStyles
  );

  const {
    isLoading,
    session,
  } = useAuth();

  const {
    errorMessage:
      profileErrorMessage,
    refreshProfile,
    status:
      profileStatus,
  } = useProfile();

  const {
    errorMessage:
      verificationErrorMessage,
    refreshVerification,
    status:
      verificationStatus,
  } = useVerification();

  const isAuthenticated =
    session !== null;

  const isProfileLoading =
    isAuthenticated &&
    (
      profileStatus ===
        'idle' ||
      profileStatus ===
        'loading'
    );

  const isVerificationLoading =
    isAuthenticated &&
    profileStatus ===
      'ready' &&
    (
      verificationStatus ===
        'idle' ||
      verificationStatus ===
        'loading'
    );

  if (
    isLoading ||
    isProfileLoading ||
    isVerificationLoading
  ) {
    return (
      <SafeAreaScreen
        style={
          styles.loadingScreen
        }
      >
        <Text
          style={
            styles.brand
          }
        >
          VĀRTĀ
        </Text>

        <ActivityIndicator
          color={
            colors.textPrimary
          }
          style={
            styles.loadingIndicator
          }
        />
      </SafeAreaScreen>
    );
  }

  if (
    isAuthenticated &&
    profileStatus ===
      'error'
  ) {
    return (
      <SafeAreaScreen
        style={
          styles.loadingScreen
        }
      >
        <Text
          style={
            styles.brand
          }
        >
          VĀRTĀ
        </Text>

        <Text
          accessibilityRole="alert"
          style={
            styles.loadError
          }
        >
          {
            profileErrorMessage
          }
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={
            refreshProfile
          }
          style={({
            pressed,
          }) => [
            styles.retryButton,
            pressed &&
              styles.retryButtonPressed,
          ]}
        >
          <Text
            style={
              styles.retryLabel
            }
          >
            Try again
          </Text>
        </Pressable>
      </SafeAreaScreen>
    );
  }

  if (
    isAuthenticated &&
    profileStatus ===
      'ready' &&
    verificationStatus ===
      'error'
  ) {
    return (
      <SafeAreaScreen
        style={
          styles.loadingScreen
        }
      >
        <Text
          style={
            styles.brand
          }
        >
          VĀRTĀ
        </Text>

        <Text
          accessibilityRole="alert"
          style={
            styles.loadError
          }
        >
          {
            verificationErrorMessage
          }
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={
            refreshVerification
          }
          style={({
            pressed,
          }) => [
            styles.retryButton,
            pressed &&
              styles.retryButtonPressed,
          ]}
        >
          <Text
            style={
              styles.retryLabel
            }
          >
            Try again
          </Text>
        </Pressable>
      </SafeAreaScreen>
    );
  }

  const needsProfile =
    isAuthenticated &&
    profileStatus ===
      'missing';

  const needsVerificationFlow =
    isAuthenticated &&
    profileStatus ===
      'ready' &&
    (
      verificationStatus ===
        'missing' ||
      verificationStatus ===
        'pending' ||
      verificationStatus ===
        'rejected'
    );

  const canAccessTabs =
    isAuthenticated &&
    profileStatus ===
      'ready' &&
    verificationStatus ===
      'verified';

  const baseNavigationTheme =
    resolvedTheme ===
    'dark'
      ? DarkTheme
      : DefaultTheme;

  const navigationTheme = {
    ...baseNavigationTheme,

    colors: {
      ...baseNavigationTheme.colors,

      background:
        colors.background,

      border:
        colors.borderSubtle,

      card:
        colors.surface,

      notification:
        colors.danger,

      primary:
        colors.textPrimary,

      text:
        colors.textPrimary,
    },
  };

  return (
    <NavigationThemeProvider
      value={
        navigationTheme
      }
    >
      <StatusBar
        style={
          resolvedTheme ===
          'dark'
            ? 'light'
            : 'dark'
        }
      />

      <Stack
        screenOptions={{
          headerShown:
            false,

          contentStyle: {
            backgroundColor:
              colors.background,
          },
        }}
      >
        <Stack.Protected
          guard={
            !isAuthenticated
          }
        >
          <Stack.Screen
            name="(auth)"
          />
        </Stack.Protected>

        <Stack.Protected
          guard={
            needsProfile ||
            needsVerificationFlow
          }
        >
          <Stack.Screen
            name="(onboarding)"
          />
        </Stack.Protected>

        <Stack.Protected
          guard={
            canAccessTabs
          }
        >
          <Stack.Screen
            name="(tabs)"
          />

          <Stack.Screen
            name="edit-profile"
          />

          <Stack.Screen
            name="settings"
          />

          <Stack.Screen
            name="blocked-users"
          />

          <Stack.Screen
            name="feedback"
          />

          <Stack.Screen
            name="notifications"
          />

          <Stack.Screen
            name="following"
          />

          <Stack.Screen
            name="post/[id]"
          />

          <Stack.Screen
            name="user/[id]"
          />

          <Stack.Screen
            name="events"
          />

          <Stack.Screen
            name="event/[id]"
          />

          <Stack.Screen
            name="event/[id]/edit"
          />

          <Stack.Screen
            name="organization/[id]"
          />

          <Stack.Screen
            name="organization/[id]/manage"
          />

          <Stack.Screen
            name="organization/[id]/edit-profile"
          />

          <Stack.Screen
            name="organization/[id]/create-event"
          />
        </Stack.Protected>
      </Stack>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider
      initialMetrics={
        initialWindowMetrics
      }
    >
      <ThemeProvider>
        <ThemedRoot />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function ThemedRoot() {
  const {
    isReady,
  } = useTheme();

  useEffect(() => {
    if (isReady) {
      void SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <AuthProvider>
      <ProfileProvider>
        <VerificationProvider>
          <NotificationsProvider>
            <FeedProvider>
              <AppNavigator />
            </FeedProvider>
          </NotificationsProvider>
        </VerificationProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}

const createStyles = (
  colors:
    ThemeColors
) =>
  StyleSheet.create({
    loadingScreen: {
      flex:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.background,
    },

    brand: {
      fontSize:
        18,

      fontWeight:
        '700',

      letterSpacing:
        4,

      color:
        colors.textPrimary,
    },

    loadingIndicator: {
      marginTop:
        spacing.lg,
    },

    loadError: {
      maxWidth:
        300,

      marginTop:
        spacing.lg,

      textAlign:
        'center',

      fontSize:
        14,

      lineHeight:
        21,

      color:
        colors.textSecondary,
    },

    retryButton: {
      minWidth:
        132,

      minHeight:
        48,

      marginTop:
        spacing.lg,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        12,

      backgroundColor:
        colors.textPrimary,
    },

    retryButtonPressed: {
      opacity:
        0.78,
    },

    retryLabel: {
      fontSize:
        14,

      fontWeight:
        '600',

      color:
        colors.white,
    },
  });