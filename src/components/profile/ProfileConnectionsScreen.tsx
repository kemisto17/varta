import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { radius, spacing, type ThemeColors } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useThemedStyles } from '../../hooks/useTheme';
import {
  getFollowedOrganizationsPage,
  getProfileConnectionsPage,
  getProfileFollowErrorMessage,
  setProfileFollow,
} from '../../lib/profileFollows';
import { setOrganizationFollow } from '../../lib/organizations';
import type {
  FollowedOrganization,
  FollowedOrganizationCursor,
  ProfileConnection,
  ProfileConnectionCursor,
  ProfileConnectionKind,
} from '../../types/profileFollow';
import { Avatar } from '../Avatar';
import { SafeAreaScreen } from '../SafeAreaScreen';
import { ScreenHeader } from '../ScreenHeader';
import { OrganizationAvatar } from '../organizations/OrganizationAvatar';

type ConnectionsTab = ProfileConnectionKind | 'organizations';
type LoadStatus = 'loading' | 'ready' | 'error';

export function ProfileConnectionsScreen({
  initialTab,
  profileId,
}: {
  initialTab: ProfileConnectionKind;
  profileId: string;
}) {
  const { styles } = useThemedStyles(createStyles);
  const { session } = useAuth();
  const viewerId = session?.user.id ?? null;
  const isOwnProfile = viewerId === profileId;
  const [activeTab, setActiveTab] = useState<ConnectionsTab>(initialTab);
  const tabs: ConnectionsTab[] = isOwnProfile
    ? ['followers', 'following', 'organizations']
    : ['followers', 'following'];

  return (
    <SafeAreaScreen style={styles.safeArea}>
      <ScreenHeader title="Connections" />
      <View accessibilityRole="tablist" style={styles.tabs}>
        {tabs.map((tab) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab }}
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={({ pressed }) => [
              styles.tab,
              activeTab === tab && styles.activeTab,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab && styles.activeTabLabel,
              ]}
            >
              {getTabLabel(tab)}
            </Text>
          </Pressable>
        ))}
      </View>

      {activeTab === 'organizations' ? (
        viewerId ? <OrganizationConnectionsList userId={viewerId} /> : null
      ) : viewerId ? (
        <PeopleConnectionsList
          isOwnProfile={isOwnProfile}
          key={`${profileId}:${activeTab}`}
          kind={activeTab}
          profileId={profileId}
          viewerId={viewerId}
        />
      ) : null}
    </SafeAreaScreen>
  );
}

function PeopleConnectionsList({
  isOwnProfile,
  kind,
  profileId,
  viewerId,
}: {
  isOwnProfile: boolean;
  kind: ProfileConnectionKind;
  profileId: string;
  viewerId: string;
}) {
  const { colors, styles } = useThemedStyles(createStyles);
  const router = useRouter();
  const requestId = useRef(0);
  const loadMorePending = useRef(false);
  const followPending = useRef(new Set<string>());
  const [connections, setConnections] = useState<ProfileConnection[]>([]);
  const [cursor, setCursor] = useState<ProfileConnectionCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [status, setStatus] = useState<LoadStatus>('loading');

  const loadInitial = useCallback(
    async (refreshing = false) => {
      const activeRequestId = requestId.current + 1;
      requestId.current = activeRequestId;

      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setStatus('loading');
      }

      try {
        const page = await getProfileConnectionsPage({ kind, profileId });

        if (requestId.current !== activeRequestId) {
          return;
        }

        setConnections(page.connections);
        setCursor(page.cursor);
        setHasMore(page.hasMore);
        setStatus('ready');
      } catch (error) {
        if (requestId.current !== activeRequestId) {
          return;
        }

        console.warn('[connections] Could not load people.', error);
        setStatus('error');
      } finally {
        if (requestId.current === activeRequestId) {
          setIsRefreshing(false);
        }
      }
    },
    [kind, profileId]
  );

  useFocusEffect(
    useCallback(() => {
      void loadInitial();
      return () => {
        requestId.current += 1;
      };
    }, [loadInitial])
  );

  const loadMore = useCallback(async () => {
    if (!cursor || !hasMore || loadMorePending.current) {
      return;
    }

    loadMorePending.current = true;
    setIsLoadingMore(true);

    try {
      const page = await getProfileConnectionsPage({ cursor, kind, profileId });
      setConnections((current) => mergeConnections(current, page.connections));
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (error) {
      console.warn('[connections] Could not load more people.', error);
    } finally {
      loadMorePending.current = false;
      setIsLoadingMore(false);
    }
  }, [cursor, hasMore, kind, profileId]);

  const toggleFollow = useCallback(
    async (connection: ProfileConnection) => {
      if (
        connection.id === viewerId ||
        followPending.current.has(connection.id)
      ) {
        return;
      }

      const nextIsFollowed = !connection.isFollowedByCurrentUser;
      followPending.current.add(connection.id);
      setConnections((current) =>
        current.map((item) =>
          item.id === connection.id
            ? { ...item, isFollowedByCurrentUser: nextIsFollowed }
            : item
        )
      );

      try {
        await setProfileFollow({
          followerId: viewerId,
          followingId: connection.id,
          isFollowed: nextIsFollowed,
        });

        if (isOwnProfile && kind === 'following' && !nextIsFollowed) {
          setConnections((current) =>
            current.filter((item) => item.id !== connection.id)
          );
        }
      } catch (error) {
        setConnections((current) =>
          current.map((item) =>
            item.id === connection.id
              ? {
                  ...item,
                  isFollowedByCurrentUser:
                    connection.isFollowedByCurrentUser,
                }
              : item
          )
        );
        Alert.alert('Could not update follow', getProfileFollowErrorMessage(error));
      } finally {
        followPending.current.delete(connection.id);
      }
    },
    [isOwnProfile, kind, viewerId]
  );

  if (status === 'loading') {
    return <ConnectionsSkeleton />;
  }

  if (status === 'error' && connections.length === 0) {
    return (
      <ConnectionsState
        actionLabel="Try again"
        message="We could not load these connections. Check your connection and try again."
        onAction={() => void loadInitial()}
        title="Connections unavailable"
      />
    );
  }

  return (
    <FlatList
      contentContainerStyle={[
        styles.connectionList,
        connections.length === 0 && styles.emptyConnectionList,
      ]}
      data={connections}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        <ConnectionsState
          message={
            kind === 'followers'
              ? 'No student followers yet.'
              : 'No students followed yet.'
          }
          title={kind === 'followers' ? 'No followers' : 'Not following anyone'}
        />
      }
      ListFooterComponent={
        isLoadingMore ? (
          <ActivityIndicator color={colors.textSecondary} style={styles.footerLoader} />
        ) : null
      }
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.35}
      refreshControl={
        <RefreshControl
          colors={[colors.textPrimary]}
          onRefresh={() => void loadInitial(true)}
          progressBackgroundColor={colors.surfaceElevated}
          refreshing={isRefreshing}
          tintColor={colors.textPrimary}
        />
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: '/user/[id]', params: { id: item.id } })
          }
          style={({ pressed }) => [
            styles.connectionRow,
            pressed && styles.rowPressed,
          ]}
        >
          <Avatar
            fullName={item.fullName}
            size={50}
            uri={item.avatarUrl}
            verified={item.isVerified}
          />
          <View style={styles.connectionCopy}>
            <View style={styles.connectionNameRow}>
              <Text numberOfLines={1} style={styles.connectionName}>
                {item.fullName}
              </Text>
              {item.isVerified ? (
                <SymbolView
                  name={{
                    android: 'verified',
                    ios: 'checkmark.seal.fill',
                    web: 'verified',
                  }}
                  size={14}
                  tintColor={colors.success}
                />
              ) : null}
            </View>
            <Text numberOfLines={1} style={styles.connectionUsername}>
              @{item.username}
            </Text>
            <Text numberOfLines={1} style={styles.connectionMeta}>
              {item.instituteShortName} · {item.branch} · {formatYear(item.year)}
            </Text>
          </View>
          {item.id !== viewerId ? (
            <Pressable
              accessibilityRole="button"
              onPress={(event) => {
                event.stopPropagation();
                void toggleFollow(item);
              }}
              style={({ pressed }) => [
                styles.rowAction,
                item.isFollowedByCurrentUser && styles.rowActionSecondary,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.rowActionLabel,
                  item.isFollowedByCurrentUser && styles.rowActionSecondaryLabel,
                ]}
              >
                {item.isFollowedByCurrentUser ? 'Following' : 'Follow'}
              </Text>
            </Pressable>
          ) : null}
        </Pressable>
      )}
      showsVerticalScrollIndicator={false}
    />
  );
}

function OrganizationConnectionsList({ userId }: { userId: string }) {
  const { colors, styles } = useThemedStyles(createStyles);
  const router = useRouter();
  const requestId = useRef(0);
  const loadMorePending = useRef(false);
  const unfollowPending = useRef(new Set<string>());
  const [organizations, setOrganizations] = useState<FollowedOrganization[]>([]);
  const [cursor, setCursor] = useState<FollowedOrganizationCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [status, setStatus] = useState<LoadStatus>('loading');

  const loadInitial = useCallback(async (refreshing = false) => {
    const activeRequestId = requestId.current + 1;
    requestId.current = activeRequestId;

    if (refreshing) {
      setIsRefreshing(true);
    } else {
      setStatus('loading');
    }

    try {
      const page = await getFollowedOrganizationsPage();
      if (requestId.current !== activeRequestId) {
        return;
      }
      setOrganizations(page.organizations);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
      setStatus('ready');
    } catch (error) {
      if (requestId.current !== activeRequestId) {
        return;
      }
      console.warn('[connections] Could not load organizations.', error);
      setStatus('error');
    } finally {
      if (requestId.current === activeRequestId) {
        setIsRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadInitial();
      return () => {
        requestId.current += 1;
      };
    }, [loadInitial])
  );

  const loadMore = useCallback(async () => {
    if (!cursor || !hasMore || loadMorePending.current) {
      return;
    }
    loadMorePending.current = true;
    setIsLoadingMore(true);
    try {
      const page = await getFollowedOrganizationsPage(cursor);
      setOrganizations((current) => mergeOrganizations(current, page.organizations));
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (error) {
      console.warn('[connections] Could not load more organizations.', error);
    } finally {
      loadMorePending.current = false;
      setIsLoadingMore(false);
    }
  }, [cursor, hasMore]);

  const unfollow = useCallback(
    async (organization: FollowedOrganization) => {
      if (unfollowPending.current.has(organization.id)) {
        return;
      }
      unfollowPending.current.add(organization.id);
      setOrganizations((current) =>
        current.filter((item) => item.id !== organization.id)
      );
      try {
        await setOrganizationFollow({
          isFollowed: false,
          organizationId: organization.id,
          userId,
        });
      } catch (error) {
        setOrganizations((current) =>
          mergeOrganizations([organization], current)
        );
        Alert.alert(
          'Could not unfollow organization',
          'Check your connection and try again.'
        );
      } finally {
        unfollowPending.current.delete(organization.id);
      }
    },
    [userId]
  );

  if (status === 'loading') {
    return <ConnectionsSkeleton />;
  }

  if (status === 'error' && organizations.length === 0) {
    return (
      <ConnectionsState
        actionLabel="Try again"
        message="We could not load followed organizations."
        onAction={() => void loadInitial()}
        title="Organizations unavailable"
      />
    );
  }

  return (
    <FlatList
      contentContainerStyle={[
        styles.connectionList,
        organizations.length === 0 && styles.emptyConnectionList,
      ]}
      data={organizations}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        <ConnectionsState
          message="Organizations you follow will stay discoverable here."
          title="No followed organizations"
        />
      }
      ListFooterComponent={
        isLoadingMore ? (
          <ActivityIndicator color={colors.textSecondary} style={styles.footerLoader} />
        ) : null
      }
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.35}
      refreshControl={
        <RefreshControl
          colors={[colors.textPrimary]}
          onRefresh={() => void loadInitial(true)}
          progressBackgroundColor={colors.surfaceElevated}
          refreshing={isRefreshing}
          tintColor={colors.textPrimary}
        />
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: '/organization/[id]',
              params: { id: item.id },
            })
          }
          style={({ pressed }) => [
            styles.connectionRow,
            pressed && styles.rowPressed,
          ]}
        >
          <OrganizationAvatar name={item.name} size={50} uri={item.avatarUrl} />
          <View style={styles.connectionCopy}>
            <View style={styles.connectionNameRow}>
              <Text numberOfLines={1} style={styles.connectionName}>
                {item.name}
              </Text>
              {item.isVerified ? (
                <SymbolView
                  name={{
                    android: 'verified',
                    ios: 'checkmark.seal.fill',
                    web: 'verified',
                  }}
                  size={14}
                  tintColor={colors.success}
                />
              ) : null}
            </View>
            <Text style={styles.connectionUsername}>Organization</Text>
            <Text style={styles.connectionMeta}>{item.campusShortName}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={(event) => {
              event.stopPropagation();
              void unfollow(item);
            }}
            style={({ pressed }) => [
              styles.rowAction,
              styles.rowActionSecondary,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.rowActionLabel, styles.rowActionSecondaryLabel]}>
              Following
            </Text>
          </Pressable>
        </Pressable>
      )}
      showsVerticalScrollIndicator={false}
    />
  );
}

function ConnectionsState({
  actionLabel,
  message,
  onAction,
  title,
}: {
  actionLabel?: string;
  message: string;
  onAction?: () => void;
  title: string;
}) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.state}>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.stateAction, pressed && styles.pressed]}
        >
          <Text style={styles.stateActionLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ConnectionsSkeleton() {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View accessibilityLabel="Loading connections" style={styles.skeleton}>
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <View key={item} style={styles.skeletonRow}>
          <View style={[styles.skeletonBlock, styles.skeletonAvatar]} />
          <View style={styles.skeletonCopy}>
            <View style={[styles.skeletonBlock, styles.skeletonName]} />
            <View style={[styles.skeletonBlock, styles.skeletonMeta]} />
          </View>
          <View style={[styles.skeletonBlock, styles.skeletonAction]} />
        </View>
      ))}
    </View>
  );
}

function mergeConnections(
  current: ProfileConnection[],
  incoming: ProfileConnection[]
) {
  const ids = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !ids.has(item.id))];
}

function mergeOrganizations(
  current: FollowedOrganization[],
  incoming: FollowedOrganization[]
) {
  const ids = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !ids.has(item.id))];
}

function getTabLabel(tab: ConnectionsTab) {
  if (tab === 'followers') return 'Followers';
  if (tab === 'following') return 'Following';
  return 'Organizations';
}

function formatYear(year: number) {
  return `Year ${year}`;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    tabs: {
      minHeight: 48,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    tab: {
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    activeTab: { borderBottomColor: colors.textPrimary },
    tabLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
    activeTabLabel: { color: colors.textPrimary },
    connectionList: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xxl,
    },
    emptyConnectionList: { flexGrow: 1 },
    connectionRow: {
      minHeight: 82,
      paddingVertical: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    rowPressed: { backgroundColor: colors.surfaceMuted },
    connectionCopy: { flex: 1, minWidth: 0, marginLeft: spacing.md },
    connectionNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    connectionName: {
      flexShrink: 1,
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    connectionUsername: { marginTop: 2, fontSize: 12, color: colors.textSecondary },
    connectionMeta: { marginTop: 3, fontSize: 11, color: colors.textMuted },
    rowAction: {
      minWidth: 80,
      minHeight: 36,
      marginLeft: spacing.sm,
      paddingHorizontal: 13,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.full,
      backgroundColor: colors.textPrimary,
    },
    rowActionSecondary: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    rowActionLabel: { fontSize: 11, fontWeight: '700', color: colors.white },
    rowActionSecondaryLabel: { color: colors.textPrimary },
    footerLoader: { marginVertical: spacing.lg },
    state: {
      flex: 1,
      minHeight: 320,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stateTitle: {
      fontSize: 19,
      fontWeight: '700',
      textAlign: 'center',
      color: colors.textPrimary,
    },
    stateMessage: {
      maxWidth: 290,
      marginTop: spacing.sm,
      fontSize: 13,
      lineHeight: 20,
      textAlign: 'center',
      color: colors.textSecondary,
    },
    stateAction: {
      minHeight: 42,
      marginTop: spacing.lg,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.full,
      backgroundColor: colors.textPrimary,
    },
    stateActionLabel: { fontSize: 12, fontWeight: '700', color: colors.white },
    skeleton: { flex: 1, paddingHorizontal: spacing.md },
    skeletonRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center' },
    skeletonBlock: { backgroundColor: colors.border, borderRadius: radius.sm },
    skeletonAvatar: { width: 50, height: 50, borderRadius: 25 },
    skeletonCopy: { flex: 1, marginLeft: spacing.md },
    skeletonName: { width: '55%', height: 11 },
    skeletonMeta: { width: '75%', height: 9, marginTop: spacing.sm },
    skeletonAction: { width: 80, height: 36, borderRadius: radius.full },
    pressed: { opacity: 0.58 },
  });
