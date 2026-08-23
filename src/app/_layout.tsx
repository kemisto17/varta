import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, spacing } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { AuthProvider } from '../providers/AuthProvider';

function AppNavigator() {
  const { isLoading, session } = useAuth();

  if (isLoading) {
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

  const isAuthenticated = session !== null;

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
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppNavigator />
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
});
