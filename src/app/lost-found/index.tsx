import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { LostFoundCard } from '../../components/lost-found/LostFoundCard';
import { SafeAreaScreen } from '../../components/SafeAreaScreen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { radius, spacing, type ThemeColors } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useThemedStyles } from '../../hooks/useTheme';
import { getLostFoundPage } from '../../lib/lostFound';
import type {
  LostFoundCursor,
  LostFoundFilter,
  LostFoundItem,
  LostFoundKind,
} from '../../types/lostFound';

const FILTERS: readonly { label: string; value: LostFoundFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Lost', value: 'lost' },
  { label: 'Found', value: 'found' },
  { label: 'Resolved', value: 'resolved' },
];

export default function LostFoundScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const router = useRouter();
  const { session } = useAuth();
  const requestIdRef = useRef(0);
  const loadMorePendingRef = useRef(false);
  const [filter, setFilter] = useState<LostFoundFilter>('all');
  const [items, setItems] = useState<LostFoundItem[]>([]);
  const [cursor, setCursor] = useState<LostFoundCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadFirstPage = useCallback(
    async (showRefresh = false) => {
      const userId = session?.user.id;
      if (!userId) {
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setErrorMessage(null);
      setIsRefreshing(showRefresh);
      if (!showRefresh) {
        setIsLoading(true);
      }

      try {
        const page = await getLostFoundPage(userId, filter);
        if (requestIdRef.current !== requestId) {
          return;
        }

        setItems(page.items);
        setCursor(page.cursor);
        setHasMore(page.hasMore);
      } catch (error) {
        if (requestIdRef.current === requestId) {
          console.warn('[lost-found] Could not load module.', error);
          setErrorMessage('Lost & Found could not be loaded.');
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [filter, session?.user.id]
  );

  useFocusEffect(
    useCallback(() => {
      void loadFirstPage();
      return () => {
        requestIdRef.current += 1;
      };
    }, [loadFirstPage])
  );

  const loadMore = async () => {
    const userId = session?.user.id;
    if (
      !userId ||
      !cursor ||
      !hasMore ||
      loadMorePendingRef.current ||
      isRefreshing
    ) {
      return;
    }

    loadMorePendingRef.current = true;
    setIsLoadingMore(true);
    setErrorMessage(null);
    const requestId = requestIdRef.current;
    const activeFilter = filter;

    try {
      const page = await getLostFoundPage(userId, filter, cursor);
      if (
        requestIdRef.current !== requestId ||
        filter !== activeFilter
      ) {
        return;
      }

      setItems((current) => {
        const existingIds = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !existingIds.has(item.id))];
      });
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (error) {
      console.warn('[lost-found] Could not load more listings.', error);
      setErrorMessage('More listings could not be loaded.');
    } finally {
      loadMorePendingRef.current = false;
      setIsLoadingMore(false);
    }
  };

  const openCreate = (kind: LostFoundKind) => {
    router.push({ pathname: '/lost-found/create', params: { kind } });
  };

  return (
    <SafeAreaScreen style={styles.screen}>
      <ScreenHeader title="Lost & Found" />

      <FlatList
        contentContainerStyle={styles.content}
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={colors.textSecondary} style={styles.loader} />
          ) : errorMessage ? (
            <ModuleState
              actionLabel="Try again"
              message={errorMessage}
              onAction={() => void loadFirstPage()}
              title="Could not load listings"
            />
          ) : (
            <ModuleState
              actionLabel={filter === 'found' ? 'Report found item' : 'Report lost item'}
              message={
                filter === 'resolved'
                  ? 'Resolved listings will appear here.'
                  : 'There are no matching active listings right now.'
              }
              onAction={() => openCreate(filter === 'found' ? 'found' : 'lost')}
              title="Nothing here yet"
            />
          )
        }
        ListFooterComponent={
          isLoadingMore ? (
            <ActivityIndicator color={colors.textSecondary} style={styles.footerLoader} />
          ) : null
        }
        ListHeaderComponent={
          <>
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <SymbolView
                  name={{ android: 'inventory_2', ios: 'shippingbox.fill', web: 'inventory_2' }}
                  size={30}
                  tintColor={colors.white}
                />
              </View>
              <Text style={styles.eyebrow}>OFFICIAL VARTA MODULE</Text>
              <Text style={styles.heroTitle}>Lost & Found</Text>
              <Text style={styles.heroMessage}>
                A structured campus space for lost and found items. Active reports
                can also appear on the main feed.
              </Text>

              <View style={styles.actions}>
                <CreateButton
                  label="Report lost item"
                  onPress={() => openCreate('lost')}
                  primary
                />
                <CreateButton
                  label="Report found item"
                  onPress={() => openCreate('found')}
                />
              </View>
            </View>

            <View style={styles.filters}>
              {FILTERS.map((option) => {
                const selected = filter === option.value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={option.value}
                    onPress={() => {
                      requestIdRef.current += 1;
                      setItems([]);
                      setCursor(null);
                      setHasMore(false);
                      setFilter(option.value);
                    }}
                    style={({ pressed }) => [
                      styles.filter,
                      selected && styles.filterSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        selected && styles.filterTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.listHeading}>
              {filter === 'resolved' ? 'RESOLVED ITEMS' : 'ACTIVE ITEMS'}
            </Text>

            {errorMessage && items.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void loadFirstPage()}
                style={({ pressed }) => [styles.inlineError, pressed && styles.pressed]}
              >
                <Text style={styles.inlineErrorText}>{errorMessage}</Text>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            ) : null}
          </>
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.35}
        refreshControl={
          <RefreshControl
            colors={[colors.textPrimary]}
            onRefresh={() => void loadFirstPage(true)}
            progressBackgroundColor={colors.surface}
            refreshing={isRefreshing}
            tintColor={colors.textPrimary}
          />
        }
        renderItem={({ item }) => (
          <LostFoundCard
            item={item}
            onPress={() =>
              router.push({
                pathname: '/lost-found/[id]',
                params: { id: item.id },
              })
            }
          />
        )}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaScreen>
  );
}

function CreateButton({
  label,
  onPress,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.createButton,
        primary && styles.createButtonPrimary,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.createButtonText,
          primary && styles.createButtonTextPrimary,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ModuleState({
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
    hero: {
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
    },
    heroIcon: {
      width: 54,
      height: 54,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.lg,
      backgroundColor: colors.textPrimary,
    },
    eyebrow: {
      marginTop: spacing.lg,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.25,
      color: colors.textMuted,
    },
    heroTitle: {
      marginTop: spacing.xs,
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: -0.5,
      color: colors.textPrimary,
    },
    heroMessage: {
      marginTop: spacing.sm,
      fontSize: 14,
      lineHeight: 21,
      color: colors.textSecondary,
    },
    actions: { marginTop: spacing.lg, gap: spacing.sm },
    createButton: {
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.full,
    },
    createButtonPrimary: {
      borderColor: colors.textPrimary,
      backgroundColor: colors.textPrimary,
    },
    createButtonText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
    createButtonTextPrimary: { color: colors.white },
    filters: {
      marginTop: spacing.xl,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    filter: {
      minHeight: 38,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.full,
    },
    filterSelected: {
      borderColor: colors.textPrimary,
      backgroundColor: colors.textPrimary,
    },
    filterText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    filterTextSelected: { color: colors.white },
    listHeading: {
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.2,
      color: colors.textMuted,
    },
    loader: { marginVertical: spacing.xl },
    footerLoader: { marginVertical: spacing.lg },
    inlineError: {
      marginBottom: spacing.sm,
      padding: spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderRadius: radius.md,
      backgroundColor: colors.dangerSoft,
    },
    inlineErrorText: { flex: 1, fontSize: 12, color: colors.danger },
    retryText: {
      marginLeft: spacing.md,
      fontSize: 12,
      fontWeight: '700',
      color: colors.danger,
    },
    state: { minHeight: 190, alignItems: 'center', justifyContent: 'center' },
    stateTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
    stateMessage: {
      maxWidth: 280,
      marginTop: spacing.sm,
      textAlign: 'center',
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary,
    },
    stateButton: {
      minHeight: 44,
      marginTop: spacing.lg,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.full,
      backgroundColor: colors.textPrimary,
    },
    stateButtonText: { fontSize: 13, fontWeight: '700', color: colors.white },
    pressed: { opacity: 0.55 },
  });
