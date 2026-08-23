import { Stack } from 'expo-router';

import { colors } from '../../constants/theme';
import { useProfile } from '../../hooks/useProfile';

export const unstable_settings = {
  initialRouteName: 'setup-profile',
};

export default function OnboardingLayout() {
  const { shouldShowVerificationPending, status } = useProfile();

  return (
    <Stack
      screenOptions={{
        animation: 'fade',
        contentStyle: { backgroundColor: colors.background },
        headerShown: false,
      }}
    >
      <Stack.Protected guard={status === 'missing'}>
        <Stack.Screen name="setup-profile" />
      </Stack.Protected>

      <Stack.Protected
        guard={status === 'ready' && shouldShowVerificationPending}
      >
        <Stack.Screen name="verification-pending" />
      </Stack.Protected>
    </Stack>
  );
}
