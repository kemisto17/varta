import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Avatar } from '../../components/Avatar';
import { FullscreenImageViewer } from '../../components/FullscreenImageViewer';
import { SafeAreaScreen } from '../../components/SafeAreaScreen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ActionSheet } from '../../components/moderation/ActionSheet';
import { OrganizationAvatar } from '../../components/organizations/OrganizationAvatar';
import { radius, spacing, type ThemeColors } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useThemedStyles } from '../../hooks/useTheme';
import { isUuid } from '../../lib/identifiers';
import {
  deleteLostFoundItem,
  getLostFoundCategoryLabel,
  getLostFoundErrorMessage,
  getLostFoundItemById,
  setLostFoundResolved,
} from '../../lib/lostFound';
import { formatRelativeTimestamp } from '../../lib/time';
import type { LostFoundItem } from '../../types/lostFound';

type DetailStatus = 'loading' | 'ready' | 'unavailable' | 'error';

export default function LostFoundDetailScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const itemId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { session } = useAuth();
  const requestIdRef = useRef(0);
  const mutationPendingRef = useRef(false);
  const [item, setItem] = useState<LostFoundItem | null>(null);
  const [status, setStatus] = useState<DetailStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOptionsVisible, setIsOptionsVisible] = useState(false);
  const [isImageViewerVisible, setIsImageViewerVisible] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  const load = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId || !isUuid(itemId)) {
      setStatus('unavailable');
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setStatus('loading');
    setErrorMessage(null);

    try {
      const nextItem = await getLostFoundItemById(itemId, userId);
      if (requestIdRef.current !== requestId) {
        return;
      }

      if (!nextItem) {
        setItem(null);
        setStatus('unavailable');
        return;
      }

      setItem(nextItem);
      setStatus('ready');
    } catch (error) {
      if (requestIdRef.current === requestId) {
        console.warn('[lost-found-detail] Could not load listing.', error);
        setErrorMessage('This listing could not be loaded.');
        setStatus('error');
      }
    }
  }, [itemId, session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        requestIdRef.current += 1;
      };
    }, [load])
  );

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/lost-found');
    }
  };

  const updateResolution = async () => {
    if (!item || mutationPendingRef.current) {
      return;
    }

    mutationPendingRef.current = true;
    setIsMutating(true);
    setErrorMessage(null);

    try {
      await setLostFoundResolved(item, item.status !== 'resolved');
      await load();
    } catch (error) {
      console.warn('[lost-found-detail] Could not update status.', error);
      setErrorMessage(getLostFoundErrorMessage(error));
    } finally {
      mutationPendingRef.current = false;
      setIsMutating(false);
    }
  };

  const confirmDelete = () => {
    if (!item || mutationPendingRef.current) {
      return;
    }

    Alert.alert(
      'Delete listing?',
      'This removes the listing from Lost & Found.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void handleDelete(),
        },
      ]
    );
  };

  const handleDelete = async () => {
    if (!item || mutationPendingRef.current) {
      return;
    }

    mutationPendingRef.current = true;
    setIsMutating(true);
    setErrorMessage(null);

    try {
      const result = await deleteLostFoundItem(item);
      if (result.mediaCleanupFailed) {
        Alert.alert(
          'Listing deleted',
          'The listing is gone, but its photo could not be cleaned up automatically.'
        );
      }
      goBack();
    } catch (error) {
      mutationPendingRef.current = false;
      setIsMutating(false);
      setErrorMessage(getLostFoundErrorMessage(error));
    }
  };

  const openAuthor = () => {
    if (!item) {
      return;
    }

    if (item.author.kind === 'organization') {
      router.push({
        pathname: '/organization/[id]',
        params: { id: item.author.id },
      });
    } else if (item.author.id === session?.user.id) {
      router.navigate('/(tabs)/profile');
    } else {
      router.push({
        pathname: '/user/[id]',
        params: { id: item.author.id },
      });
    }
  };

  const headerAction = item?.canEditByCurrentUser ? (
    <Pressable
      accessibilityLabel="Listing options"
      accessibilityRole="button"
      disabled={isMutating}
      onPress={() => setIsOptionsVisible(true)}
      style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
    >
      {isMutating ? (
        <ActivityIndicator color={colors.textSecondary} size="small" />
      ) : (
        <SymbolView
          name={{ android: 'more_horiz', ios: 'ellipsis', web: 'more_horiz' }}
          size={21}
          tintColor={colors.textPrimary}
        />
      )}
    </Pressable>
  ) : null;

  return (
    <SafeAreaScreen style={styles.screen}>
      <ScreenHeader action={headerAction} fallbackRoute="/lost-found" title="Lost & Found" />

      {status === 'loading' ? (
        <ActivityIndicator color={colors.textSecondary} style={styles.loader} />
      ) : status === 'unavailable' ? (
        <DetailState
          actionLabel="Back to Lost & Found"
          message="It may have been deleted, or it is not available to your university."
          onAction={goBack}
          title="Listing unavailable"
        />
      ) : status === 'error' || !item ? (
        <DetailState
          actionLabel="Try again"
          message={errorMessage ?? 'This listing could not be loaded.'}
          onAction={() => void load()}
          title="Could not load listing"
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.badges}>
            <Text style={styles.moduleLabel}>VARTA LOST & FOUND</Text>
            <View
              style={[
                styles.kindBadge,
                item.kind === 'lost' ? styles.lostBadge : styles.foundBadge,
              ]}
            >
              <Text style={styles.kindText}>
                {item.kind === 'lost' ? 'LOST' : 'FOUND'}
              </Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {item.status === 'resolved' ? 'RESOLVED' : 'ACTIVE'}
              </Text>
            </View>
          </View>

          <Text style={styles.title}>{item.title}</Text>

          <Pressable
            accessibilityRole="button"
            onPress={openAuthor}
            style={({ pressed }) => [styles.authorRow, pressed && styles.pressed]}
          >
            {item.author.kind === 'student' ? (
              <Avatar
                fullName={item.author.fullName}
                size={42}
                uri={item.author.avatarUrl}
                verified={item.author.isVerified}
              />
            ) : (
              <OrganizationAvatar
                name={item.author.fullName}
                size={42}
                uri={item.author.avatarUrl}
              />
            )}
            <View style={styles.authorCopy}>
              <Text style={styles.authorName}>{item.author.fullName}</Text>
              <Text style={styles.authorMeta}>
                {item.author.kind === 'student'
                  ? `@${item.author.username} · ${item.author.institute.short_name}`
                  : `Official organization · ${item.author.campusShortName}`}
              </Text>
              <Text style={styles.authorTime}>
                Posted {formatRelativeTimestamp(item.createdAt)}
              </Text>
            </View>
          </Pressable>

          {item.imageUrl ? (
            <Pressable
              accessibilityLabel="Open item photo fullscreen"
              accessibilityRole="button"
              onPress={() => setIsImageViewerVisible(true)}
              style={({ pressed }) => pressed && styles.imagePressed}
            >
              <Image
                accessibilityLabel={`Photo of ${item.title}`}
                cachePolicy="memory-disk"
                contentFit="contain"
                source={item.imageUrl}
                style={styles.image}
              />
            </Pressable>
          ) : null}

          <Text style={styles.description}>{item.description}</Text>

          <View style={styles.detailsCard}>
            <DetailRow
              label="Category"
              value={getLostFoundCategoryLabel(item.category)}
            />
            <DetailRow
              label={item.kind === 'lost' ? 'Date lost' : 'Date found'}
              value={formatItemDate(item.itemDate)}
            />
            <DetailRow
              label="Campus location"
              value={item.campusLocation ?? 'Not specified'}
            />
          </View>

          {errorMessage ? (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {errorMessage}
            </Text>
          ) : null}
        </ScrollView>
      )}

      {item?.imageUrl ? (
        <FullscreenImageViewer
          images={[{ accessibilityLabel: `Photo of ${item.title}`, uri: item.imageUrl }]}
          onClose={() => setIsImageViewerVisible(false)}
          visible={isImageViewerVisible}
        />
      ) : null}

      <ActionSheet
        actions={
          item
            ? [
                {
                  label: 'Edit listing',
                  onPress: () =>
                    router.push({
                      pathname: '/lost-found/[id]/edit',
                      params: { id: item.id },
                    }),
                },
                {
                  label: item.status === 'resolved' ? 'Reopen listing' : 'Mark resolved',
                  onPress: () => void updateResolution(),
                },
                {
                  label: 'Delete listing',
                  onPress: confirmDelete,
                  tone: 'danger' as const,
                },
              ]
            : []
        }
        message="Manage this Lost & Found listing."
        onClose={() => setIsOptionsVisible(false)}
        title="Listing options"
        visible={isOptionsVisible}
      />
    </SafeAreaScreen>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function DetailState({
  actionLabel,
  message,
  onAction,
  title,
}: {
  actionLabel: string;
  message: string;
  onAction: () => void;
  title: string;
}) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.state}>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onAction}
        style={({ pressed }) => [styles.stateButton, pressed && styles.pressed]}
      >
        <Text style={styles.stateButtonText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

function formatItemDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    headerAction: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loader: { marginTop: spacing.xxl },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
    badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
    moduleLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.15,
      color: colors.textMuted,
    },
    kindBadge: { paddingVertical: 4, paddingHorizontal: spacing.sm, borderRadius: radius.full },
    lostBadge: { backgroundColor: colors.dangerSoft },
    foundBadge: { backgroundColor: colors.successSoft },
    kindText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.7, color: colors.textPrimary },
    statusBadge: { paddingVertical: 4, paddingHorizontal: spacing.sm, borderRadius: radius.full, backgroundColor: colors.borderSubtle },
    statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: colors.textSecondary },
    title: { marginTop: spacing.md, fontSize: 29, lineHeight: 35, fontWeight: '700', color: colors.textPrimary },
    authorRow: { marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center' },
    authorCopy: { flex: 1, marginLeft: spacing.md },
    authorName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    authorMeta: { marginTop: 2, fontSize: 12, color: colors.textSecondary },
    authorTime: { marginTop: 2, fontSize: 11, color: colors.textMuted },
    image: { width: '100%', marginTop: spacing.lg, aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: colors.borderSubtle },
    imagePressed: { opacity: 0.86 },
    description: { marginTop: spacing.lg, fontSize: 16, lineHeight: 25, color: colors.textPrimary },
    detailsCard: { marginTop: spacing.xl, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.lg, backgroundColor: colors.surface },
    detailRow: { minHeight: 62, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSubtle },
    detailLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
    detailValue: { marginTop: spacing.xs, fontSize: 14, color: colors.textPrimary },
    errorText: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, fontSize: 12, color: colors.danger, backgroundColor: colors.dangerSoft },
    state: { flex: 1, padding: spacing.lg, alignItems: 'flex-start', justifyContent: 'center' },
    stateTitle: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
    stateMessage: { maxWidth: 320, marginTop: spacing.sm, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
    stateButton: { minHeight: 44, marginTop: spacing.lg, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full, backgroundColor: colors.textPrimary },
    stateButtonText: { fontSize: 13, fontWeight: '700', color: colors.white },
    pressed: { opacity: 0.55 },
  });
