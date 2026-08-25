import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '../../../components/ScreenHeader';
import { EventFormScreen } from '../../../components/events/EventFormScreen';
import { colors, spacing } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { getEventById, updateOrganizationEvent } from '../../../lib/events';
import type { EventDetail, EventFormValues } from '../../../types/event';

export default function EditEventScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const eventId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { session } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;
    const userId = session?.user.id;

    if (!eventId || !userId) {
      setIsLoading(false);
      return () => { isActive = false; };
    }

    void getEventById(eventId, userId)
      .then((result) => {
        if (isActive && result?.canManage) {
          setEvent(result);
        }
      })
      .catch((error) => console.warn('[edit-event] Could not load event.', error))
      .finally(() => { if (isActive) setIsLoading(false); });

    return () => { isActive = false; };
  }, [eventId, session?.user.id]);

  const submit = async (values: EventFormValues) => {
    if (!event) {
      throw new Error('Event editing is unavailable.');
    }

    await updateOrganizationEvent({ event, values });
    router.replace({ pathname: '/event/[id]', params: { id: event.id } });
  };

  if (isLoading) {
    return <SafeAreaView style={styles.safeArea}><ScreenHeader title="Edit event" /><View style={styles.center}><ActivityIndicator color={colors.textSecondary} /></View></SafeAreaView>;
  }

  if (!event) {
    return <SafeAreaView style={styles.safeArea}><ScreenHeader title="Edit event" /><View style={styles.center}><Text style={styles.title}>Editing unavailable</Text><Text style={styles.message}>You do not have permission to edit this event.</Text></View></SafeAreaView>;
  }

  return (
    <EventFormScreen
      initialEvent={event}
      onSubmit={submit}
      organizationName={event.organization.name}
      submitLabel="Save changes"
      title="Edit event"
    />
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, padding: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', color: colors.textPrimary },
  message: { maxWidth: 290, marginTop: spacing.sm, fontSize: 14, lineHeight: 21, textAlign: 'center', color: colors.textSecondary },
});
