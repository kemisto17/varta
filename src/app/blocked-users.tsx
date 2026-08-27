import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Avatar } from '../components/Avatar';
import { SafeAreaScreen } from '../components/SafeAreaScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { radius, spacing, type ThemeColors } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useThemedStyles } from '../hooks/useTheme';
import {
  getBlockedUsers,
  unblockUser,
  type BlockedUser,
} from '../lib/moderation';

type ScreenStatus = 'loading' | 'ready' | 'error';

export default function BlockedUsersScreen() {
  const { session } = useAuth();
  const { colors, styles } = useThemedStyles(createStyles);
  const userId = session?.user.id ?? null;
  const requestIdRef = useRef(0);
  const hasLoadedRef = useRef(false);
  const pendingIdsRef = useRef(new Set<string>());
  const activeUserIdRef = useRef<string | null>(null);

  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [status, setStatus] = useState<ScreenStatus>('loading');

  useEffect(() => {
    activeUserIdRef.current = userId;
    requestIdRef.current += 1;
    hasLoadedRef.current = false;
    pendingIdsRef.current.clear();
    setBlockedUsers([]);
    setErrorMessage(null);
    setPendingIds(new Set());
    setStatus('loading');
  }, [userId]);

  const loadBlockedUsers = useCallback(async () => {
    if (!userId) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setErrorMessage(null);

    if (!hasLoadedRef.current) {
      setStatus('loading');
    }

    try {
      const nextBlockedUsers = await getBlockedUsers();

      if (requestIdRef.current !== requestId) {
        return;
      }

      hasLoadedRef.current = true;
      setBlockedUsers(nextBlockedUsers);
      setStatus('ready');
    } catch (error) {
      if (requestIdRef.current !== requestId) {
        return;
      }

      console.warn('[blocked-users] Could not load blocked users.', error);
      setErrorMessage('Check your connection and try again.');
      setStatus(hasLoadedRef.current ? 'ready' : 'error');
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void loadBlockedUsers();
    }, [loadBlockedUsers])
  );

  const handleUnblock = useCallback(
    async (blockedUser: BlockedUser) => {
      if (!userId) {
        return;
      }

      if (pendingIdsRef.current.has(blockedUser.id)) {
        return;
      }

      pendingIdsRef.current.add(blockedUser.id);
      setPendingIds((current) => new Set(current).add(blockedUser.id));
      setErrorMessage(null);

      try {
        await unblockUser(userId, blockedUser.id);

        if (activeUserIdRef.current !== userId) {
          return;
        }

        setBlockedUsers((current) =>
          current.filter((user) => user.id !== blockedUser.id)
        );
      } catch (error) {
        if (activeUserIdRef.current !== userId) {
          return;
        }

        console.warn('[blocked-users] Could not unblock user.', error);
        Alert.alert('Could not unblock', 'Check your connection and try again.');
      } finally {
        pendingIdsRef.current.delete(blockedUser.id);

        if (activeUserIdRef.current !== userId) {
          return;
        }

        setPendingIds((current) => {
          const next = new Set(current);
          next.delete(blockedUser.id);
          return next;
        });
      }
    },
    [userId]
  );

  const confirmUnblock = useCallback(
    (blockedUser: BlockedUser) => {
      if (!userId || pendingIdsRef.current.has(blockedUser.id)) {
        return;
      }

      Alert.alert(
        `Unblock ${blockedUser.fullName}?`,
        'They may appear in your feed and search results again.',
        [
          { style: 'cancel', text: 'Cancel' },
          {
            text: 'Unblock',
            onPress: () => void handleUnblock(blockedUser),
          },
        ]
      );
    },
    [handleUnblock, userId]
  );

  return (
    <SafeAreaScreen style={styles.safeArea}>
      <ScreenHeader title="Blocked users" />
      {status === 'loading' ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      ) : status === 'error' ? (
        <View style={styles.state}>
          <Text style={styles.stateTitle}>Could not load blocked users</Text>
          <Text style={styles.stateMessage}>
            {errorMessage ?? 'Check your connection and try again.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void loadBlockedUsers()}
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={blockedUsers}
          keyExtractor={(user) => user.id}
          ListEmptyComponent={
            <View style={styles.state}>
              <Text style={styles.stateTitle}>No blocked users</Text>
              <Text style={styles.stateMessage}>
                Students you block will appear here.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isPending = pendingIds.has(item.id);

            return (
              <View style={styles.userRow}>
                <Avatar
                  fullName={item.fullName}
                  size={44}
                  uri={item.avatarUrl}
                />
                <View style={styles.identity}>
                  <Text numberOfLines={1} style={styles.name}>
                    {item.fullName}
                  </Text>
                  <Text numberOfLines={1} style={styles.username}>
                    @{item.username}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel={`Unblock ${item.fullName}`}
                  accessibilityRole="button"
                  disabled={isPending}
                  onPress={() => confirmUnblock(item)}
                  style={({ pressed }) => [
                    styles.unblockButton,
                    pressed && styles.pressed,
                  ]}
                >
                  {isPending ? (
                    <ActivityIndicator color={colors.textPrimary} size="small" />
                  ) : (
                    <Text style={styles.unblockText}>Unblock</Text>
                  )}
                </Pressable>
              </View>
            );
          }}
        />
      )}
      {errorMessage && status === 'ready' ? (
        <Text accessibilityRole="alert" style={styles.inlineError}>
          {errorMessage}
        </Text>
      ) : null}
    </SafeAreaScreen>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    list: {
      flexGrow: 1,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    userRow: {
      minHeight: 72,
      paddingVertical: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    identity: {
      flex: 1,
    },
    name: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    username: {
      marginTop: 2,
      fontSize: 12,
      color: colors.textSecondary,
    },
    unblockButton: {
      minWidth: 80,
      minHeight: 44,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.full,
      backgroundColor: colors.surface,
    },
    unblockText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    state: {
      flex: 1,
      minHeight: 280,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stateTitle: {
      fontSize: 18,
      fontWeight: '700',
      textAlign: 'center',
      color: colors.textPrimary,
    },
    stateMessage: {
      maxWidth: 280,
      marginTop: spacing.sm,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
      color: colors.textSecondary,
    },
    retryButton: {
      minHeight: 44,
      marginTop: spacing.lg,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.full,
      backgroundColor: colors.textPrimary,
    },
    retryText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.white,
    },
    inlineError: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      textAlign: 'center',
      fontSize: 12,
      color: colors.danger,
      backgroundColor: colors.dangerSoft,
    },
    pressed: {
      opacity: 0.58,
    },
  });
