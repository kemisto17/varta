import { useLocalSearchParams } from 'expo-router';

import { StudentProfileScreen } from '../../components/profile/StudentProfileScreen';

export default function UserProfileScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const profileId = Array.isArray(params.id) ? params.id[0] : params.id;

  return <StudentProfileScreen profileId={profileId ?? ''} showBackButton />;
}
