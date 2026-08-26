import Constants, {
  AppOwnership,
  ExecutionEnvironment,
} from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { getPushNotificationDestination } from './notificationRouting';
import { supabase } from './supabase';

export type PushRegistrationResult =
  | { status: 'registered' }
  | {
      reason:
        | 'expo-go'
        | 'missing-project-id'
        | 'not-a-device'
        | 'unsupported-platform';
      status: 'unavailable';
    }
  | { status: 'denied' }
  | { status: 'error' };

let currentExpoPushToken: string | null = null;
let foregroundHandlerConfigured = false;

export async function registerForPushNotifications(
  userId: string
): Promise<PushRegistrationResult> {
  const capability = getPushCapability();

  if (!capability.supported) {
    return { reason: capability.reason, status: 'unavailable' };
  }

  try {
    const Notifications = await import('expo-notifications');

    configureForegroundHandler(Notifications);

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        importance: Notifications.AndroidImportance.DEFAULT,
        name: 'Varta activity',
      });
    }

    const existingPermissions = await Notifications.getPermissionsAsync();
    let hasPermission = notificationPermissionGranted(
      existingPermissions,
      Notifications
    );

    if (!hasPermission) {
      const requestedPermissions = await Notifications.requestPermissionsAsync();
      hasPermission = notificationPermissionGranted(
        requestedPermissions,
        Notifications
      );
    }

    if (!hasPermission) {
      return { status: 'denied' };
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: capability.projectId,
    });

    await savePushToken(userId, token.data);
    currentExpoPushToken = token.data;

    return { status: 'registered' };
  } catch (error) {
    console.warn('[push] Push token registration is not available yet.', error);
    return { status: 'error' };
  }
}

export async function subscribeToPushTokenChanges(userId: string) {
  const capability = getPushCapability();

  if (!capability.supported) {
    return () => undefined;
  }

  const Notifications = await import('expo-notifications');
  const subscription = Notifications.addPushTokenListener((devicePushToken) => {
    void Notifications.getExpoPushTokenAsync({
      devicePushToken,
      projectId: capability.projectId,
    })
      .then(async (token) => {
        await savePushToken(userId, token.data);
        currentExpoPushToken = token.data;
      })
      .catch((error: unknown) => {
        console.warn('[push] Could not refresh the device push token.', error);
      });
  });

  return () => subscription.remove();
}

export async function subscribeToPushNotificationResponses(
  onOpen: (destination: NonNullable<ReturnType<typeof getPushNotificationDestination>>) => void
) {
  const capability = getPushCapability();

  if (!capability.supported) {
    return () => undefined;
  }

  const Notifications = await import('expo-notifications');
  const handleResponse = (
    response: ReturnType<typeof Notifications.getLastNotificationResponse>
  ) => {
    if (!response) {
      return;
    }

    const destination = getPushNotificationDestination(
      response.notification.request.content.data
    );

    if (!destination) {
      return;
    }

    Notifications.clearLastNotificationResponse();
    onOpen(destination);
  };

  handleResponse(Notifications.getLastNotificationResponse());

  const subscription = Notifications.addNotificationResponseReceivedListener(
    handleResponse
  );

  return () => subscription.remove();
}

export async function deleteCurrentPushToken(userId: string) {
  if (!currentExpoPushToken) {
    return;
  }

  const token = currentExpoPushToken;
  const { error } = await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('token', token);

  if (error) {
    throw error;
  }

  currentExpoPushToken = null;
}

export function isRunningInExpoGo() {
  return (
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient &&
    Constants.appOwnership === AppOwnership.Expo
  );
}

async function savePushToken(_userId: string, token: string) {
  const platform = Platform.OS;

  if (platform !== 'android' && platform !== 'ios') {
    return;
  }

  const { error } = await supabase.rpc('register_push_token', {
    device_platform: platform,
    expo_token: token,
  });

  if (error) {
    throw error;
  }
}

function configureForegroundHandler(
  Notifications: typeof import('expo-notifications')
) {
  if (foregroundHandlerConfigured) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  foregroundHandlerConfigured = true;
}

function notificationPermissionGranted(
  permissions: import('expo-notifications').NotificationPermissionsStatus,
  Notifications: typeof import('expo-notifications')
) {
  if (Platform.OS !== 'ios') {
    return permissions.granted || permissions.status === 'granted';
  }

  const iosStatus = permissions.ios?.status;

  return (
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

type PushCapability =
  | { projectId: string; supported: true }
  | {
      reason:
        | 'expo-go'
        | 'missing-project-id'
        | 'not-a-device'
        | 'unsupported-platform';
      supported: false;
    };

function getPushCapability(): PushCapability {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return { reason: 'unsupported-platform', supported: false };
  }

  if (isRunningInExpoGo()) {
    return { reason: 'expo-go', supported: false };
  }

  if (!Device.isDevice) {
    return { reason: 'not-a-device', supported: false };
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (typeof projectId !== 'string' || projectId.length === 0) {
    return { reason: 'missing-project-id', supported: false };
  }

  return { projectId, supported: true };
}
