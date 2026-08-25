import { useLocalSearchParams } from 'expo-router';

import { ProfileConnectionsScreen } from '../components/profile/ProfileConnectionsScreen';
import type { ProfileConnectionKind } from '../types/profileFollow';

export default function ConnectionsRoute() {
  const params = useLocalSearchParams<{
    initialTab?: string | string[];
    profileId?: string | string[];
  }>();
  const profileId = getParam(params.profileId);
  const requestedTab = getParam(params.initialTab);
  const initialTab: ProfileConnectionKind =
    requestedTab === 'following' ? 'following' : 'followers';

  return (
    <ProfileConnectionsScreen
      initialTab={initialTab}
      profileId={profileId ?? ''}
    />
  );
}

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
