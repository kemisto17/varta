import { useThemedStyles } from '../hooks/useTheme';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator, Alert, Pressable, RefreshControl, SectionList, StyleSheet, Text, View, } from 'react-native';

import { SafeAreaScreen } from '../components/SafeAreaScreen';
import { spacing, type ThemeColors } from '../constants/theme';
import { useNotifications } from '../hooks/useNotifications';
import { useVerification } from '../hooks/useVerification';
import type { AppNotification } from '../lib/notifications';
import { formatRelativeTimestamp } from '../lib/time';

type NotificationSection = {
  data: AppNotification[];
  title: 'Today' | 'Yesterday' | 'Earlier';
};

export default function NotificationsScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const router = useRouter();
  const { refreshVerification } = useVerification();
  const {
    errorMessage,
    isLoadingMore,
    isRefreshing,
    loadMore,
    markAllRead,
    markRead,
    notifications,
    refreshNotifications,
    status,
    unreadCount,
  } = useNotifications();
  const sections = useMemo(
    () => groupNotifications(notifications),
    [notifications]
  );

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [router]);

  const handleNotificationPress = useCallback(
    async (notification: AppNotification) => {
      try {
        await markRead(notification.id);
      } catch {
        Alert.alert(
          'Could not open notification',
          'We could not mark this notification as read. Please try again.'
        );
        return;
      }

      if (
        (notification.type === 'post_like' ||
          notification.type === 'post_comment' ||
          notification.type === 'mention') &&
        notification.post_id
      ) {
        router.push({
          pathname: '/post/[id]',
          params: { id: notification.post_id },
        });
        return;
      }

      if (
        (notification.type === 'event_cancelled' ||
          notification.type === 'event_updated') &&
        notification.event_id
      ) {
        router.push({
          pathname: '/event/[id]',
          params: { id: notification.event_id },
        });
        return;
      }

      if (
        notification.type === 'organization_role_assigned' &&
        notification.organization_id
      ) {
        router.push({
          pathname: '/organization/[id]',
          params: { id: notification.organization_id },
        });
        return;
      }

      if (notification.type === 'verification_rejected') {
        refreshVerification();
        goBack();
        return;
      }

      if (
        notification.type === 'verification_approved' ||
        notification.type === 'badge_assigned'
      ) {
        router.replace('/(tabs)/profile');
      }
    },
    [goBack, markRead, refreshVerification, router]
  );

  const handleMarkAllRead = useCallback(async () => {
    try {
      await markAllRead();
    } catch {
      Alert.alert(
        'Could not update notifications',
        'Your notifications could not be marked as read. Please try again.'
      );
    }
  }, [markAllRead]);

  const isInitialLoading = status === 'idle' || status === 'loading';

  return (
    <SafeAreaScreen style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={goBack}
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.pressed,
          ]}
        >
          <SymbolView
            name={{
              android: 'arrow_back',
              ios: 'chevron.left',
              web: 'arrow_back',
            }}
            size={22}
            tintColor={colors.textPrimary}
          />
        </Pressable>

        <Text style={styles.headerTitle}>Notifications</Text>

        <Pressable
          accessibilityRole="button"
          disabled={unreadCount === 0}
          onPress={() => void handleMarkAllRead()}
          style={({ pressed }) => [
            styles.markAllButton,
            pressed && unreadCount > 0 && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.markAllLabel,
              unreadCount === 0 && styles.markAllLabelDisabled,
            ]}
          >
            Mark all read
          </Text>
        </Pressable>
      </View>

      {isInitialLoading ? (
        <NotificationsSkeleton />
      ) : status === 'error' && notifications.length === 0 ? (
        <NotificationsState
          actionLabel="Try again"
          message={
            errorMessage ??
            'We could not load your notifications. Check your connection and try again.'
          }
          onAction={() => void refreshNotifications()}
          title="Notifications are unavailable"
        />
      ) : (
        <SectionList
          contentContainerStyle={[
            styles.listContent,
            notifications.length === 0 && styles.emptyListContent,
          ]}
          sections={sections}
          keyExtractor={(notification) => notification.id}
          ListEmptyComponent={
            <NotificationsState
              message="New activity will appear here."
              title="You're all caught up."
            />
          }
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator
                color={colors.textSecondary}
                style={styles.footerLoader}
              />
            ) : null
          }
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.35}
          refreshControl={
            <RefreshControl
              colors={[colors.textPrimary]}
              onRefresh={() => void refreshNotifications()}
              progressBackgroundColor={colors.surfaceElevated}
              refreshing={isRefreshing}
              tintColor={colors.textPrimary}
            />
          }
          renderItem={({ item }) => (
            <NotificationRow
              notification={item}
              onPress={handleNotificationPress}
            />
          )}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          )}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      )}
    </SafeAreaScreen>
  );
}

type NotificationRowProps = {
  notification: AppNotification;
  onPress: (notification: AppNotification) => void;
};

function NotificationRow({ notification, onPress }: NotificationRowProps) {
  const { styles } = useThemedStyles(createStyles);
  const isUnread = notification.read_at === null;
  const body = getVisibleBody(notification);

  return (
    <Pressable
      accessibilityLabel={`${isUnread ? 'Unread. ' : ''}${notification.title}`}
      accessibilityRole="button"
      onPress={() => onPress(notification)}
      style={({ pressed }) => [
        styles.notificationRow,
        isUnread && styles.unreadRow,
        pressed && styles.pressedRow,
      ]}
    >
      <View style={styles.indicatorColumn}>
        <View
          style={[
            styles.indicator,
            isUnread ? styles.unreadIndicator : styles.readIndicator,
          ]}
        />
      </View>

      <View style={styles.notificationCopy}>
        <Text
          style={[
            styles.notificationTitle,
            isUnread && styles.unreadTitle,
          ]}
        >
          {notification.title}
        </Text>
        {body ? <Text style={styles.notificationBody}>{body}</Text> : null}
      </View>

      <Text style={styles.notificationTime}>
        {formatRelativeTimestamp(notification.created_at)}
      </Text>
    </Pressable>
  );
}

type NotificationsStateProps = {
  actionLabel?: string;
  message: string;
  onAction?: () => void;
  title: string;
};

function NotificationsState({
  actionLabel,
  message,
  onAction,
  title,
}: NotificationsStateProps) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.state}>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [
            styles.stateAction,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.stateActionLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function NotificationsSkeleton() {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View accessibilityLabel="Loading notifications" style={styles.skeleton}>
      <View style={[styles.skeletonBlock, styles.skeletonSection]} />
      {[0, 1, 2, 3, 4].map((item) => (
        <View key={item} style={styles.skeletonRow}>
          <View style={[styles.skeletonBlock, styles.skeletonDot]} />
          <View style={styles.skeletonCopy}>
            <View style={[styles.skeletonBlock, styles.skeletonTitle]} />
            <View style={[styles.skeletonBlock, styles.skeletonBody]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function groupNotifications(notifications: AppNotification[]) {
  const today: AppNotification[] = [];
  const yesterday: AppNotification[] = [];
  const earlier: AppNotification[] = [];
  const startOfToday = startOfLocalDay(new Date());
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

  for (const notification of notifications) {
    const createdAt = new Date(notification.created_at).getTime();

    if (createdAt >= startOfToday) {
      today.push(notification);
    } else if (createdAt >= startOfYesterday) {
      yesterday.push(notification);
    } else {
      earlier.push(notification);
    }
  }

  return [
    { data: today, title: 'Today' as const },
    { data: yesterday, title: 'Yesterday' as const },
    { data: earlier, title: 'Earlier' as const },
  ].filter((section): section is NotificationSection => section.data.length > 0);
}

function startOfLocalDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime();
}

function getVisibleBody(notification: AppNotification) {
  if (notification.type === 'post_like') {
    return null;
  }

  if (notification.type === 'post_comment' && notification.body) {
    return `“${notification.body}”`;
  }

  return notification.body || null;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    minHeight: 60,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },

  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  markAllButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingLeft: spacing.sm,
  },

  markAllLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  markAllLabelDisabled: {
    color: colors.textMuted,
  },

  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  emptyListContent: {
    flexGrow: 1,
  },

  sectionTitle: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: colors.textMuted,
    backgroundColor: colors.background,
  },

  notificationRow: {
    minHeight: 76,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },

  unreadRow: {
    backgroundColor: colors.surfaceMuted,
  },

  pressedRow: {
    opacity: 0.62,
  },

  indicatorColumn: {
    width: 18,
    paddingTop: 6,
  },

  indicator: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  unreadIndicator: {
    backgroundColor: colors.textPrimary,
  },

  readIndicator: {
    borderWidth: 1,
    borderColor: colors.border,
  },

  notificationCopy: {
    flex: 1,
    paddingRight: spacing.md,
  },

  notificationTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: colors.textSecondary,
  },

  unreadTitle: {
    fontWeight: '700',
    color: colors.textPrimary,
  },

  notificationBody: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  notificationTime: {
    paddingTop: 1,
    fontSize: 11,
    color: colors.textMuted,
  },

  footerLoader: {
    marginVertical: spacing.lg,
  },

  state: {
    flex: 1,
    minHeight: 360,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  stateTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.textPrimary,
  },

  stateMessage: {
    maxWidth: 280,
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: colors.textSecondary,
  },

  stateAction: {
    minHeight: 44,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: colors.textPrimary,
  },

  stateActionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },

  skeleton: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },

  skeletonRow: {
    height: 76,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },

  skeletonBlock: {
    backgroundColor: colors.border,
  },

  skeletonSection: {
    width: 54,
    height: 9,
    marginBottom: spacing.sm,
  },

  skeletonDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  skeletonCopy: {
    flex: 1,
    marginLeft: 11,
  },

  skeletonTitle: {
    width: '72%',
    height: 11,
    borderRadius: 5,
  },

  skeletonBody: {
    width: '48%',
    height: 9,
    marginTop: spacing.sm,
    borderRadius: 5,
  },

  pressed: {
    opacity: 0.55,
  },
});
