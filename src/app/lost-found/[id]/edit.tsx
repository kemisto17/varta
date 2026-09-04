import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  LostFoundFormScreen,
  type LostFoundFormSubmission,
} from '../../../components/lost-found/LostFoundFormScreen';
import { SafeAreaScreen } from '../../../components/SafeAreaScreen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { spacing, type ThemeColors } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { useThemedStyles } from '../../../hooks/useTheme';
import { isUuid } from '../../../lib/identifiers';
import {
  getLostFoundItemById,
  updateLostFoundItem,
} from '../../../lib/lostFound';
import type { LostFoundItem } from '../../../types/lostFound';

export default function EditLostFoundScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const itemId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { session } = useAuth();
  const [item, setItem] = useState<LostFoundItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const userId = session?.user.id;
    let isActive = true;

    if (!userId || !isUuid(itemId)) {
      setIsLoading(false);
      return () => {
        isActive = false;
      };
    }

    void getLostFoundItemById(itemId, userId)
      .then((result) => {
        if (isActive && result?.canEditByCurrentUser) {
          setItem(result);
        }
      })
      .catch((error) => {
        console.warn('[edit-lost-found] Could not load listing.', error);
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [itemId, session?.user.id]);

  const handleSubmit = async ({
    asset,
    draft,
    removeImage,
  }: LostFoundFormSubmission) => {
    if (!item) {
      throw new Error('This listing could not be found.');
    }

    await updateLostFoundItem({ asset, draft, item, removeImage });

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace({
        pathname: '/lost-found/[id]',
        params: { id: item.id },
      });
    }
  };

  if (isLoading) {
    return (
      <SafeAreaScreen style={styles.screen}>
        <ScreenHeader title="Edit listing" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      </SafeAreaScreen>
    );
  }

  if (!item) {
    return (
      <SafeAreaScreen style={styles.screen}>
        <ScreenHeader title="Edit listing" />
        <View style={styles.center}>
          <Text style={styles.title}>Editing unavailable</Text>
          <Text style={styles.message}>
            This listing no longer exists, or you do not have permission to edit it.
          </Text>
        </View>
      </SafeAreaScreen>
    );
  }

  return (
    <LostFoundFormScreen
      initialItem={item}
      kind={item.kind}
      onSubmit={handleSubmit}
      submitLabel="Save"
      title="Edit listing"
    />
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    center: {
      flex: 1,
      padding: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
    message: {
      maxWidth: 300,
      marginTop: spacing.sm,
      textAlign: 'center',
      fontSize: 14,
      lineHeight: 21,
      color: colors.textSecondary,
    },
  });
