import { useThemedStyles } from '../../hooks/useTheme';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View, } from 'react-native';

import { FullscreenImageViewer } from '../../components/FullscreenImageViewer';
import { SafeAreaScreen } from '../../components/SafeAreaScreen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { OrganizationAvatar } from '../../components/organizations/OrganizationAvatar';
import { radius, spacing, type ThemeColors } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import {
  cancelOrganizationEvent,
  getEventById,
  getEventErrorMessage,
  setEventInterest,
} from '../../lib/events';
import { formatEventDateRange } from '../../lib/time';
import { isUuid } from '../../lib/identifiers';
import type { EventDetail } from '../../types/event';

type DetailStatus = 'loading' | 'ready' | 'unavailable' | 'error';

export default function EventDetailScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const eventId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const requestIdRef = useRef(0);
  const eventRef = useRef<EventDetail | null>(null);
  const interestPendingRef = useRef(false);
  const cancellationPendingRef = useRef(false);
  const activeUserIdRef = useRef<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [isInterestPending, setIsInterestPending] = useState(false);
  const [status, setStatus] = useState<DetailStatus>('loading');

  useEffect(() => {
    activeUserIdRef.current = userId;
    requestIdRef.current += 1;
    interestPendingRef.current = false;
    cancellationPendingRef.current = false;
    setIsCancelling(false);
    setIsInterestPending(false);
  }, [eventId, userId]);

  const loadEvent = useCallback(async () => {
    if (!isUuid(eventId) || !userId) {
      setStatus('unavailable');
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const hasExistingEvent = eventRef.current?.id === eventId;
    setErrorMessage(null);

    if (!hasExistingEvent) {
      setStatus('loading');
    }

    try {
      const nextEvent = await getEventById(eventId, userId);

      if (requestIdRef.current !== requestId) {
        return;
      }

      eventRef.current = nextEvent;
      setEvent(nextEvent);
      setStatus(nextEvent ? 'ready' : 'unavailable');
    } catch (error) {
      if (requestIdRef.current !== requestId) {
        return;
      }

      console.warn('[event-detail] Could not load event.', error);
      setErrorMessage('We could not load this event. Check your connection and try again.');
      setStatus(hasExistingEvent ? 'ready' : 'error');
    }
  }, [eventId, userId]);

  useFocusEffect(
    useCallback(() => {
      void loadEvent();

      return () => {
        requestIdRef.current += 1;
      };
    }, [loadEvent])
  );

  const toggleInterest = async () => {
    if (!event || !userId || interestPendingRef.current || event.status !== 'published') {
      return;
    }

    const previous = event.isInterested;
    const next = !previous;
    interestPendingRef.current = true;
    setIsInterestPending(true);
    setErrorMessage(null);
    const optimisticEvent = { ...event, isInterested: next };
    eventRef.current = optimisticEvent;
    setEvent(optimisticEvent);

    try {
      await setEventInterest({ eventId: event.id, isInterested: next, userId });
    } catch (error) {
      if (activeUserIdRef.current !== userId) {
        return;
      }

      console.warn('[event-detail] Could not update interest.', error);
      setEvent((current) => {
        if (!current || current.id !== event.id || current.isInterested !== next) {
          return current;
        }

        const rolledBack = { ...current, isInterested: previous };
        eventRef.current = rolledBack;
        return rolledBack;
      });
      setErrorMessage(getEventErrorMessage(error));
    } finally {
      interestPendingRef.current = false;

      if (activeUserIdRef.current === userId) {
        setIsInterestPending(false);
      }
    }
  };

  const confirmCancellation = () => {
    if (!event || cancellationPendingRef.current || event.status === 'cancelled') {
      return;
    }

    Alert.alert(
      'Cancel this event?',
      'The event will remain visible as cancelled, and interested students will be notified.',
      [
        { style: 'cancel', text: 'Keep event' },
        {
          style: 'destructive',
          text: 'Cancel event',
          onPress: () => void cancelEvent(),
        },
      ]
    );
  };

  const cancelEvent = async () => {
    if (!event || cancellationPendingRef.current) {
      return;
    }

    cancellationPendingRef.current = true;
    setIsCancelling(true);
    setErrorMessage(null);

    try {
      await cancelOrganizationEvent(event.id);

      if (activeUserIdRef.current !== userId) {
        return;
      }

      const cancelledEvent: EventDetail = { ...event, status: 'cancelled' };
      eventRef.current = cancelledEvent;
      setEvent(cancelledEvent);
    } catch (error) {
      if (activeUserIdRef.current !== userId) {
        return;
      }

      console.warn('[event-detail] Could not cancel event.', error);
      setErrorMessage(getEventErrorMessage(error));
    } finally {
      cancellationPendingRef.current = false;

      if (activeUserIdRef.current === userId) {
        setIsCancelling(false);
      }
    }
  };

  const openRegistration = async () => {
    if (!event?.registrationUrl?.startsWith('https://')) {
      return;
    }

    try {
      await Linking.openURL(event.registrationUrl);
    } catch {
      Alert.alert('Could not open link', 'Please try again in a moment.');
    }
  };

  return (
    <SafeAreaScreen style={styles.safeArea}>
      <ScreenHeader
        action={
          event?.canManage ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/event/[id]/edit', params: { id: event.id } })
              }
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.editLabel}>Edit</Text>
            </Pressable>
          ) : null
        }
        title="Event"
      />

      {status === 'loading' ? (
        <View style={styles.center}><ActivityIndicator color={colors.textSecondary} /></View>
      ) : status === 'unavailable' ? (
        <State title="Event unavailable" message="This event may have been removed or is not visible to your institute." />
      ) : status === 'error' || !event ? (
        <State
          actionLabel="Try again"
          message={errorMessage ?? 'Check your connection and try again.'}
          onAction={() => void loadEvent()}
          title="Could not load event"
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {event.coverUrl ? (
            <Pressable accessibilityRole="button" onPress={() => setIsImageOpen(true)}>
              <Image
                accessibilityLabel={`${event.title} cover`}
                cachePolicy="memory-disk"
                contentFit="cover"
                source={{ uri: event.coverUrl }}
                style={styles.cover}
                transition={150}
              />
            </Pressable>
          ) : null}

          <View style={styles.body}>
            {event.status !== 'published' ? (
              <Text style={[styles.statusLabel, event.status === 'cancelled' && styles.cancelled]}>
                {event.status.toUpperCase()}
              </Text>
            ) : null}
            <Text style={[styles.title, event.status === 'cancelled' && styles.cancelledTitle]}>
              {event.title}
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/organization/[id]',
                  params: { id: event.organization.id },
                })
              }
              style={({ pressed }) => [styles.organizationRow, pressed && styles.pressed]}
            >
              <OrganizationAvatar
                name={event.organization.name}
                size={34}
                uri={event.organization.avatarUrl}
              />
              <Text style={styles.organizationName}>{event.organization.name}</Text>
              {event.organization.isVerified ? (
                <SymbolView
                  name={{ android: 'verified', ios: 'checkmark.seal.fill', web: 'verified' }}
                  size={17}
                  tintColor={colors.textPrimary}
                />
              ) : null}
            </Pressable>

            <View style={styles.factBlock}>
              <Fact icon={{ android: 'event', ios: 'calendar', web: 'event' }} text={formatEventDateRange(event.startsAt, event.endsAt)} />
              {event.location ? (
                <Fact icon={{ android: 'location_on', ios: 'mappin.and.ellipse', web: 'location_on' }} text={event.location} />
              ) : null}
            </View>

            {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}

            {event.status === 'published' ? (
              <Pressable
                accessibilityRole="button"
                disabled={isInterestPending}
                onPress={() => void toggleInterest()}
                style={({ pressed }) => [
                  styles.interestButton,
                  event.isInterested && styles.interestButtonActive,
                  pressed && styles.pressed,
                  isInterestPending && styles.disabled,
                ]}
              >
                <Text style={[styles.interestText, event.isInterested && styles.interestTextActive]}>
                  {event.isInterested ? 'Interested ✓' : 'Mark Interested'}
                </Text>
              </Pressable>
            ) : null}

            {event.description ? (
              <View style={styles.descriptionBlock}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.description}>{event.description}</Text>
              </View>
            ) : null}

            {event.registrationUrl && event.status !== 'cancelled' ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => void openRegistration()}
                style={({ pressed }) => [styles.registrationButton, pressed && styles.pressed]}
              >
                <Text style={styles.registrationText}>Open registration</Text>
                <SymbolView
                  name={{ android: 'open_in_new', ios: 'arrow.up.right', web: 'open_in_new' }}
                  size={16}
                  tintColor={colors.white}
                />
              </Pressable>
            ) : null}

            {event.canManage && event.status !== 'cancelled' && event.status !== 'draft' ? (
              <Pressable
                accessibilityRole="button"
                disabled={isCancelling}
                onPress={confirmCancellation}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.cancelButtonText}>
                  {isCancelling ? 'Cancelling…' : 'Cancel event'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      )}

      {event?.coverUrl ? (
        <FullscreenImageViewer
          images={[{ accessibilityLabel: `${event.title} cover`, uri: event.coverUrl }]}
          onClose={() => setIsImageOpen(false)}
          visible={isImageOpen}
        />
      ) : null}
    </SafeAreaScreen>
  );
}

function Fact({
  icon,
  text,
}: {
  icon: React.ComponentProps<typeof SymbolView>['name'];
  text: string;
}) {
  const { colors, styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.fact}>
      <SymbolView name={icon} size={19} tintColor={colors.textSecondary} />
      <Text style={styles.factText}>{text}</Text>
    </View>
  );
}

function State({ actionLabel, message, onAction, title }: { actionLabel?: string; message: string; onAction?: () => void; title: string }) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.center}>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={styles.stateButton}>
          <Text style={styles.stateButtonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, padding: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: spacing.xxl },
  cover: { width: '100%', aspectRatio: 16 / 10, backgroundColor: colors.borderSubtle },
  body: { padding: spacing.lg },
  editLabel: { padding: spacing.sm, fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  statusLabel: { marginBottom: spacing.sm, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, color: colors.textSecondary },
  cancelled: { color: colors.danger },
  title: { fontSize: 31, lineHeight: 38, fontWeight: '700', color: colors.textPrimary },
  cancelledTitle: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  organizationRow: { marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  organizationName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  factBlock: { marginTop: spacing.xl, gap: spacing.md },
  fact: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  factText: { flex: 1, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  interestButton: { minHeight: 50, marginTop: spacing.xl, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.textPrimary, borderRadius: radius.full },
  interestButtonActive: { backgroundColor: colors.textPrimary },
  interestText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  interestTextActive: { color: colors.white },
  descriptionBlock: { marginTop: spacing.xl, paddingTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  description: { marginTop: spacing.sm, fontSize: 15, lineHeight: 24, color: colors.textSecondary },
  registrationButton: { minHeight: 52, marginTop: spacing.xl, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.full, backgroundColor: colors.textPrimary },
  registrationText: { fontSize: 14, fontWeight: '700', color: colors.white },
  cancelButton: { minHeight: 48, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center' },
  cancelButtonText: { fontSize: 13, fontWeight: '700', color: colors.danger },
  error: { marginTop: spacing.lg, fontSize: 13, lineHeight: 19, color: colors.danger },
  stateTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', color: colors.textPrimary },
  stateMessage: { maxWidth: 290, marginTop: spacing.sm, fontSize: 14, lineHeight: 21, textAlign: 'center', color: colors.textSecondary },
  stateButton: { minHeight: 44, marginTop: spacing.lg, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full, backgroundColor: colors.textPrimary },
  stateButtonText: { fontSize: 13, fontWeight: '700', color: colors.white },
  pressed: { opacity: 0.55 },
  disabled: { opacity: 0.45 },
});
