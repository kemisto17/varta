import { useThemedStyles } from '../../../hooks/useTheme';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SafeAreaScreen } from '../../../components/SafeAreaScreen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { EventCard } from '../../../components/events/EventCard';
import { radius, spacing, type ThemeColors } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { getManagedOrganizationEvents } from '../../../lib/events';
import { getOrganizationById, isOrganizationManagerRole } from '../../../lib/organizations';
import type { ManageableEvent } from '../../../types/event';
import type { CampusOrganization } from '../../../types/organization';

export default function ManageOrganizationScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const organizationId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { session } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [events, setEvents] = useState<ManageableEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<CampusOrganization | null>(null);

  const loadPage = useCallback(async () => {
    const userId = session?.user.id;

    if (!organizationId || !userId) {
      setIsLoading(false);
      return;
    }

    setErrorMessage(null);

    try {
      const nextOrganization = await getOrganizationById(organizationId, userId);

      const role = nextOrganization?.role ?? null;

      if (!nextOrganization || !isOrganizationManagerRole(role)) {
        setOrganization(null);
        setIsLoading(false);
        return;
      }

      const nextEvents = await getManagedOrganizationEvents(organizationId, userId, role);
      setOrganization(nextOrganization);
      setEvents(nextEvents);
    } catch (error) {
      console.warn('[organization-manage] Could not load page.', error);
      setErrorMessage('We could not load organization management. Try again.');
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, session?.user.id]);

  useFocusEffect(useCallback(() => { void loadPage(); }, [loadPage]));

  return (
    <SafeAreaScreen style={styles.safeArea}>
      <ScreenHeader title="Manage" />
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.textSecondary} /></View>
      ) : !organization ? (
        <View style={styles.center}><Text style={styles.stateTitle}>Management unavailable</Text><Text style={styles.stateMessage}>Only an organization owner, admin, or editor can open this page.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>{organization.role?.toUpperCase()}</Text>
          <Text style={styles.title}>{organization.name}</Text>
          <Text style={styles.subtitle}>Create official events and maintain the events you are allowed to edit.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/organization/[id]/create-event', params: { id: organization.id } })}
            style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}
          >
            <Text style={styles.createButtonText}>Create event</Text>
          </Pressable>
          <Text style={styles.sectionTitle}>Organization events</Text>
          {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}
          {events.length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyTitle}>No events yet.</Text><Text style={styles.emptyMessage}>Create the first structured event for this organization.</Text></View>
          ) : events.map((event) => (
            <View key={event.id}>
              <EventCard event={event} onPress={(item) => router.push({ pathname: '/event/[id]', params: { id: item.id } })} />
              {event.canEdit ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/event/[id]/edit', params: { id: event.id } })}
                  style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
                >
                  <Text style={styles.editText}>Edit event</Text>
                </Pressable>
              ) : <Text style={styles.readOnly}>Created by another editor · read only</Text>}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaScreen>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, padding: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: colors.textMuted },
  title: { marginTop: spacing.xs, fontSize: 29, fontWeight: '700', color: colors.textPrimary },
  subtitle: { maxWidth: 330, marginTop: spacing.sm, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  createButton: { minHeight: 52, marginTop: spacing.xl, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full, backgroundColor: colors.textPrimary },
  createButtonText: { fontSize: 14, fontWeight: '700', color: colors.white },
  sectionTitle: { marginTop: spacing.xxl, marginBottom: spacing.md, fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  editButton: { minHeight: 40, marginTop: -spacing.sm, marginBottom: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  editText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  readOnly: { marginTop: -spacing.xs, marginBottom: spacing.lg, textAlign: 'center', fontSize: 11, color: colors.textMuted },
  empty: { minHeight: 150, padding: spacing.lg, justifyContent: 'center', borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.lg, backgroundColor: colors.surface },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  emptyMessage: { marginTop: spacing.xs, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  error: { marginBottom: spacing.md, fontSize: 13, color: colors.danger },
  stateTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', color: colors.textPrimary },
  stateMessage: { maxWidth: 290, marginTop: spacing.sm, fontSize: 14, lineHeight: 21, textAlign: 'center', color: colors.textSecondary },
  pressed: { opacity: 0.55 },
});
