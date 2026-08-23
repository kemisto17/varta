import { Stack } from 'expo-router';

import { colors } from '../../constants/theme';
import { useProfile } from '../../hooks/useProfile';
import { useVerification } from '../../hooks/useVerification';

export const unstable_settings = {
  initialRouteName: 'setup-profile',
};

export default function OnboardingLayout() {
  const { status: profileStatus } = useProfile();
  const { status: verificationStatus } = useVerification();

  return (
    <Stack
      screenOptions={{
        animation: 'fade',
        contentStyle: { backgroundColor: colors.background },
        headerShown: false,
      }}
    >
      <Stack.Protected guard={profileStatus === 'missing'}>
        <Stack.Screen name="setup-profile" />
      </Stack.Protected>

      <Stack.Protected
        guard={
          profileStatus === 'ready' && verificationStatus === 'missing'
        }
      >
        <Stack.Screen name="student-verification" />
      </Stack.Protected>

      <Stack.Protected
        guard={profileStatus === 'ready' && verificationStatus === 'pending'}
      >
        <Stack.Screen name="verification-pending" />
      </Stack.Protected>

      <Stack.Protected
        guard={profileStatus === 'ready' && verificationStatus === 'rejected'}
      >
        <Stack.Screen name="verification-rejected" />
      </Stack.Protected>
    </Stack>
  );
}
