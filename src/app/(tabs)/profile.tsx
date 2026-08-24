import { StudentProfileScreen } from '../../components/profile/StudentProfileScreen';
import { useAuth } from '../../hooks/useAuth';

export default function ProfileScreen() {
  const { session } = useAuth();

  return (
    <StudentProfileScreen profileId={session?.user.id ?? ''} />
  );
}
