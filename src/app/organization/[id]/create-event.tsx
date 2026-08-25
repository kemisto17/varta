import { useThemedStyles } from '../../../hooks/useTheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { SafeAreaScreen } from '../../../components/SafeAreaScreen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { EventFormScreen } from '../../../components/events/EventFormScreen';
import { spacing, type ThemeColors } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { createOrganizationEvent } from '../../../lib/events';
import { getOrganizationById, isOrganizationManagerRole } from '../../../lib/organizations';
import type { EventFormValues } from '../../../types/event';
import type { CampusOrganization } from '../../../types/organization';

export default function CreateEventScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const organizationId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { session } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<CampusOrganization | null>(null);

  useEffect(() => {
    let isActive = true;
    const userId = session?.user.id;

    if (!organizationId || !userId) {
      setIsLoading(false);
      return () => { isActive = false; };
    }

    void getOrganizationById(organizationId, userId)
      .then((result) => {
        if (isActive && result && isOrganizationManagerRole(result.role)) {
          setOrganization(result);
        }
      })
      .catch((error) => console.warn('[create-event] Could not load organization.', error))
      .finally(() => { if (isActive) setIsLoading(false); });

    return () => { isActive = false; };
  }, [organizationId, session?.user.id]);

  const submit = async (values: EventFormValues) => {
    const userId = session?.user.id;

    if (!organization || !userId) {
      throw new Error('Event creation is unavailable.');
    }

    const event = await createOrganizationEvent({ organization, userId, values });
    router.replace({ pathname: '/event/[id]', params: { id: event.id } });
  };

  if (isLoading) {
    return <SafeAreaScreen style={styles.safeArea}><ScreenHeader title="Create event" /><View style={styles.center}><ActivityIndicator color={colors.textSecondary} /></View></SafeAreaScreen>;
  }

  if (!organization) {
    return <SafeAreaScreen style={styles.safeArea}><ScreenHeader title="Create event" /><View style={styles.center}><Text style={styles.title}>Creation unavailable</Text><Text style={styles.message}>Only an organization owner, admin, or editor can create official events.</Text></View></SafeAreaScreen>;
  }

  return (
    <EventFormScreen
      onSubmit={submit}
      organizationName={organization.name}
      submitLabel="Publish event"
      title="Create event"
    />
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, padding: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', color: colors.textPrimary },
  message: { maxWidth: 290, marginTop: spacing.sm, fontSize: 14, lineHeight: 21, textAlign: 'center', color: colors.textSecondary },
});
