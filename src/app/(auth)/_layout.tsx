import { useTheme } from '../../hooks/useTheme';
import { Stack } from 'expo-router';



export const unstable_settings = {
  initialRouteName: 'welcome',
};

export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
