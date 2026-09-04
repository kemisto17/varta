import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';

import CreatePostScreen from '../create-post';
import type { CreateContentType } from '../../components/CreateTypeSelector';
import {
  LostFoundFormScreen,
  type LostFoundFormSubmission,
} from '../../components/lost-found/LostFoundFormScreen';
import { useAuth } from '../../hooks/useAuth';
import { createLostFoundItem } from '../../lib/lostFound';

export default function CreateScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [contentType, setContentType] =
    useState<CreateContentType>('post');
  const [lostFoundFormVersion, setLostFoundFormVersion] = useState(0);

  const handleCreateTypeChange = useCallback((type: CreateContentType) => {
    Keyboard.dismiss();
    setContentType(type);
  }, []);

  const handleLostFoundSubmit = async ({
    asset,
    draft,
  }: LostFoundFormSubmission) => {
    const userId = session?.user.id;
    if (!userId) {
      throw new Error('You must be signed in.');
    }

    const item = await createLostFoundItem({ asset, draft, userId });

    setLostFoundFormVersion((current) => current + 1);
    setContentType('post');
    router.push({
      pathname: '/lost-found/[id]',
      params: { id: item.id },
    });
  };

  const isPostSelected = contentType === 'post';
  const lostFoundKind = contentType === 'found' ? 'found' : 'lost';

  return (
    <View style={styles.screen}>
      <View
        accessibilityElementsHidden={!isPostSelected}
        importantForAccessibility={
          isPostSelected ? 'auto' : 'no-hide-descendants'
        }
        pointerEvents={isPostSelected ? 'auto' : 'none'}
        style={[styles.pane, !isPostSelected && styles.hiddenPane]}
      >
        <CreatePostScreen
          onCreateTypeChange={handleCreateTypeChange}
          withinTabNavigator
        />
      </View>

      <View
        accessibilityElementsHidden={isPostSelected}
        importantForAccessibility={
          isPostSelected ? 'no-hide-descendants' : 'auto'
        }
        pointerEvents={isPostSelected ? 'none' : 'auto'}
        style={[styles.pane, isPostSelected && styles.hiddenPane]}
      >
        <LostFoundFormScreen
          key={`lost-found-create-${lostFoundFormVersion}`}
          kind={lostFoundKind}
          onCreateTypeChange={handleCreateTypeChange}
          onSubmit={handleLostFoundSubmit}
          submitLabel="Publish"
          title={
            lostFoundKind === 'lost'
              ? 'Report lost item'
              : 'Report found item'
          }
          withinTabNavigator
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  pane: { flex: 1 },
  hiddenPane: { display: 'none' },
});
