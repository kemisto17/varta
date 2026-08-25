import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ScreenHeader } from '../../components/ScreenHeader';
import { EventCard } from '../../components/events/EventCard';
import { colors, radius, spacing } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { getOrganizationUpcomingEvents, setEventInterest } from '../../lib/events';
import {
  getOrganizationById,
  getOrganizationErrorMessage,
  isOrganizationManagerRole,
  setOrganizationFollow,
} from '../../lib/organizations';
import type { CampusEvent } from '../../types/event';
import type { CampusOrganization } from '../../types/organization';

type PageStatus = 'loading' | 'ready' | 'unavailable' | 'error';

export default function OrganizationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const organizationId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { session } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [interestPendingIds, setInterestPendingIds] = useState<Set<string>>(() => new Set());
  const [isFollowPending, setIsFollowPending] = useState(false);
  const [organization, setOrganization] = useState<CampusOrganization | null>(null);
  const [status, setStatus] = useState<PageStatus>('loading');

  const loadPage = useCallback(async () => {
    const userId = session?.user.id;

    if (!organizationId || !userId) {
      setStatus('unavailable');
      return;
    }

    setErrorMessage(null);

    try {
      const nextOrganization = await getOrganizationById(organizationId, userId);

      if (!nextOrganization) {
        setOrganization(null);
        setStatus('unavailable');
        return;
      }

      const nextEvents = await getOrganizationUpcomingEvents(organizationId, userId);
      setOrganization(nextOrganization);
      setEvents(nextEvents);
      setStatus('ready');
    } catch (error) {
      console.warn('[organization] Could not load page.', error);
      setErrorMessage(getOrganizationErrorMessage());
      setStatus('error');
    }
  }, [organizationId, session?.user.id]);

  useFocusEffect(useCallback(() => { void loadPage(); }, [loadPage]));

  const toggleFollow = async () => {
    const userId = session?.user.id;

    if (!organization || !userId || isFollowPending) {
      return;
    }

    const previous = organization.isFollowed;
    setIsFollowPending(true);
    setOrganization({ ...organization, isFollowed: !previous });

    try {
      await setOrganizationFollow({
        isFollowed: !previous,
        organizationId: organization.id,
        userId,
      });
    } catch (error) {
      console.warn('[organization] Could not update follow.', error);
      setOrganization((current) => current ? { ...current, isFollowed: previous } : current);
      setErrorMessage('We could not update this follow. Please try again.');
    } finally {
      setIsFollowPending(false);
    }
  };

  const toggleInterest = async (event: CampusEvent) => {
    const userId = session?.user.id;

    if (!userId || interestPendingIds.has(event.id)) {
      return;
    }

    const next = !event.isInterested;
    setInterestPendingIds((current) => new Set(current).add(event.id));
    setEvents((current) => current.map((item) => item.id === event.id ? { ...item, isInterested: next } : item));

    try {
      await setEventInterest({ eventId: event.id, isInterested: next, userId });
    } catch (error) {
      console.warn('[organization] Could not update event interest.', error);
      setEvents((current) => current.map((item) => item.id === event.id ? { ...item, isInterested: event.isInterested } : item));
      setErrorMessage('We could not save this event. Please try again.');
    } finally {
      setInterestPendingIds((current) => {
        const nextIds = new Set(current);
        nextIds.delete(event.id);
        return nextIds;
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        action={
          organization && isOrganizationManagerRole(organization.role) ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/organization/[id]/manage', params: { id: organization.id } })}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.manageLabel}>Manage</Text>
            </Pressable>
          ) : null
        }
        title="Organization"
      />
      {status === 'loading' ? (
        <View style={styles.center}><ActivityIndicator color={colors.textSecondary} /></View>
      ) : status === 'unavailable' ? (
        <State message="This organization is not available." title="Organization unavailable" />
      ) : status === 'error' || !organization ? (
        <State actionLabel="Try again" message={errorMessage ?? getOrganizationErrorMessage()} onAction={() => void loadPage()} title="Could not load organization" />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{organization.name.slice(0, 1).toUpperCase()}</Text></View>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{organization.name}</Text>
              {organization.isVerified ? (
                <SymbolView name={{ android: 'verified', ios: 'checkmark.seal.fill', web: 'verified' }} size={20} tintColor={colors.textPrimary} />
              ) : null}
            </View>
            {organization.description ? <Text style={styles.description}>{organization.description}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={isFollowPending}
              onPress={() => void toggleFollow()}
              style={({ pressed }) => [styles.followButton, organization.isFollowed && styles.followButtonActive, pressed && styles.pressed]}
            >
              <Text style={[styles.followText, organization.isFollowed && styles.followTextActive]}>
                {organization.isFollowed ? 'Following' : 'Follow'}
              </Text>
            </Pressable>
          </View>

          {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}
          <Text style={styles.sectionTitle}>Upcoming events</Text>
          {events.length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyTitle}>Nothing scheduled yet.</Text><Text style={styles.emptyMessage}>New events from this organization will appear here.</Text></View>
          ) : events.map((event) => (
            <EventCard
              event={event}
              interestPending={interestPendingIds.has(event.id)}
              key={event.id}
              onInterestToggle={toggleInterest}
              onPress={(item) => router.push({ pathname: '/event/[id]', params: { id: item.id } })}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function State({ actionLabel, message, onAction, title }: { actionLabel?: string; message: string; onAction?: () => void; title: string }) {
  return <View style={styles.center}><Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateMessage}>{message}</Text>{actionLabel && onAction ? <Pressable accessibilityRole="button" onPress={onAction} style={styles.stateButton}><Text style={styles.stateButtonText}>{actionLabel}</Text></Pressable> : null}</View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, padding: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  manageLabel: { padding: spacing.sm, fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  hero: { alignItems: 'center', paddingVertical: spacing.lg },
  avatar: { width: 82, height: 82, borderRadius: 41, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.textPrimary },
  avatarText: { fontSize: 27, fontWeight: '700', color: colors.white },
  nameRow: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { maxWidth: 280, fontSize: 25, fontWeight: '700', textAlign: 'center', color: colors.textPrimary },
  description: { maxWidth: 330, marginTop: spacing.sm, fontSize: 14, lineHeight: 21, textAlign: 'center', color: colors.textSecondary },
  followButton: { minWidth: 120, minHeight: 44, marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.textPrimary, borderRadius: radius.full },
  followButtonActive: { backgroundColor: colors.textPrimary },
  followText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  followTextActive: { color: colors.white },
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.md, fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  empty: { minHeight: 150, padding: spacing.lg, justifyContent: 'center', borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.lg, backgroundColor: colors.surface },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  emptyMessage: { marginTop: spacing.xs, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  error: { marginTop: spacing.md, fontSize: 13, color: colors.danger },
  stateTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', color: colors.textPrimary },
  stateMessage: { maxWidth: 290, marginTop: spacing.sm, fontSize: 14, lineHeight: 21, textAlign: 'center', color: colors.textSecondary },
  stateButton: { minHeight: 44, marginTop: spacing.lg, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full, backgroundColor: colors.textPrimary },
  stateButtonText: { fontSize: 13, fontWeight: '700', color: colors.white },
  pressed: { opacity: 0.55 },
});
