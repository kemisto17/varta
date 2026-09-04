import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';

import {
  LostFoundFormScreen,
  type LostFoundFormSubmission,
} from '../../components/lost-found/LostFoundFormScreen';
import type { CreateContentType } from '../../components/CreateTypeSelector';
import { useAuth } from '../../hooks/useAuth';
import { createLostFoundItem } from '../../lib/lostFound';
import type { LostFoundKind } from '../../types/lostFound';

export default function CreateLostFoundScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    kind?: string | string[];
    source?: string | string[];
  }>();
  const { session } = useAuth();
  const rawKind = Array.isArray(params.kind) ? params.kind[0] : params.kind;
  const rawSource = Array.isArray(params.source)
    ? params.source[0]
    : params.source;
  const initialKind: LostFoundKind = rawKind === 'found' ? 'found' : 'lost';
  const kindRef = useRef<LostFoundKind>(initialKind);
  const navigationPendingRef = useRef(false);
  const [isChangingCreateType, setIsChangingCreateType] = useState(false);
  const [kind, setKind] = useState<LostFoundKind>(initialKind);

  const handleCreateTypeChange = (type: CreateContentType) => {
    if (navigationPendingRef.current || type === kindRef.current) {
      return;
    }

    if (type === 'post') {
      navigationPendingRef.current = true;
      setIsChangingCreateType(true);

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/create');
      }

      return;
    }

    kindRef.current = type;
    setKind(type);
  };

  const handleSubmit = async ({ asset, draft }: LostFoundFormSubmission) => {
    const userId = session?.user.id;
    if (!userId) {
      throw new Error('You must be signed in.');
    }

    const item = await createLostFoundItem({ asset, draft, userId });
    router.replace({
      pathname: '/lost-found/[id]',
      params: { id: item.id },
    });
  };

  return (
    <LostFoundFormScreen
      createTypeChangeDisabled={isChangingCreateType}
      kind={kind}
      onCreateTypeChange={
        rawSource === 'create' ? handleCreateTypeChange : undefined
      }
      onSubmit={handleSubmit}
      submitLabel="Publish"
      title={kind === 'lost' ? 'Report lost item' : 'Report found item'}
    />
  );
}
