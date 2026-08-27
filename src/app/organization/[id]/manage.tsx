import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useThemedStyles } from '../../../hooks/useTheme';

import { SafeAreaScreen } from '../../../components/SafeAreaScreen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { EventCard } from '../../../components/events/EventCard';
import { LinksEditor } from '../../../components/links/LinksEditor';
import { radius, spacing, type ThemeColors } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { getManagedOrganizationEvents } from '../../../lib/events';
import { isUuid } from '../../../lib/identifiers';
import {
  getLinksErrorMessage,
  getOrganizationLinks,
  replaceOrganizationLinks,
  type StructuredLinkDraft,
} from '../../../lib/links';
import {
  canManageOrganizationLinks,
  getOrganizationById,
  isOrganizationManagerRole,
} from '../../../lib/organizations';
import type { ManageableEvent } from '../../../types/event';
import type { CampusOrganization } from '../../../types/organization';

export default function ManageOrganizationScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const router = useRouter();

  const params = useLocalSearchParams<{
    id: string | string[];
  }>();

  const organizationId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const requestIdRef = useRef(0);
  const organizationRef = useRef<CampusOrganization | null>(null);
  const saveLinksPendingRef = useRef(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [events, setEvents] = useState<ManageableEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingLinks, setIsSavingLinks] = useState(false);
  const [links, setLinks] = useState<StructuredLinkDraft[]>([]);
  const [organization, setOrganization] =
    useState<CampusOrganization | null>(null);

  useEffect(() => {
    requestIdRef.current += 1;
    organizationRef.current = null;
    saveLinksPendingRef.current = false;
    setErrorMessage(null);
    setEvents([]);
    setIsLoading(true);
    setIsSavingLinks(false);
    setLinks([]);
    setOrganization(null);
  }, [organizationId, userId]);

  const loadPage = useCallback(async () => {
    if (!isUuid(organizationId) || !userId) {
      setIsLoading(false);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const hasExistingOrganization =
      organizationRef.current?.id === organizationId;

    if (!hasExistingOrganization) {
      setIsLoading(true);
    }

    setErrorMessage(null);

    try {
      const nextOrganization = await getOrganizationById(
        organizationId,
        userId
      );

      const role = nextOrganization?.role ?? null;

      if (requestIdRef.current !== requestId) {
        return;
      }

      if (!nextOrganization || !isOrganizationManagerRole(role)) {
        organizationRef.current = null;
        setOrganization(null);
        return;
      }

      const [nextEvents, nextLinks] = await Promise.all([
        getManagedOrganizationEvents(
          organizationId,
          userId,
          role
        ),
        getOrganizationLinks(organizationId),
      ]);

      if (requestIdRef.current !== requestId) {
        return;
      }

      organizationRef.current = nextOrganization;
      setOrganization(nextOrganization);
      setEvents(nextEvents);
      setLinks(
        nextLinks.map(({ label, url }) => ({
          label,
          url,
        }))
      );
    } catch (error) {
      if (requestIdRef.current !== requestId) {
        return;
      }

      console.warn(
        '[organization-manage] Could not load page.',
        error
      );

      setErrorMessage(
        'We could not load organization management. Try again.'
      );
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [organizationId, userId]);

  useFocusEffect(
    useCallback(() => {
      void loadPage();

      return () => {
        requestIdRef.current += 1;
      };
    }, [loadPage])
  );

  const saveLinks = async () => {
    if (
      !organization ||
      !canManageOrganizationLinks(organization.role) ||
      saveLinksPendingRef.current
    ) {
      return;
    }

    saveLinksPendingRef.current = true;
    setIsSavingLinks(true);
    setErrorMessage(null);

    try {
      await replaceOrganizationLinks(
        organization.id,
        links
      );
    } catch (error) {
      console.warn(
        '[organization-manage] Could not save links.',
        error
      );

      setErrorMessage(getLinksErrorMessage(error));
    } finally {
      saveLinksPendingRef.current = false;
      setIsSavingLinks(false);
    }
  };

  const canEditOrganizationProfile =
    organization?.role === 'owner' ||
    organization?.role === 'admin';

  return (
    <SafeAreaScreen style={styles.safeArea}>
      <ScreenHeader title="Manage" />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      ) : !organization ? (
        <View style={styles.center}>
          <Text style={styles.stateTitle}>
            Management unavailable
          </Text>

          <Text style={styles.stateMessage}>
            Only an organization owner, admin, or editor can
            open this page.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.eyebrow}>
            {organization.role?.toUpperCase()}
          </Text>

          <Text style={styles.title}>
            {organization.name}
          </Text>

          <Text style={styles.subtitle}>
            Create official events and maintain the events you
            are allowed to edit.
          </Text>

          {canEditOrganizationProfile ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname:
                    '/organization/[id]/edit-profile',
                  params: {
                    id: organization.id,
                  },
                })
              }
              style={({ pressed }) => [
                styles.profileButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.profileButtonText}>
                Edit organization profile
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.profilePermissionNote}>
              Only owners and admins can change the organization
              profile.
            </Text>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname:
                  '/organization/[id]/create-event',
                params: {
                  id: organization.id,
                },
              })
            }
            style={({ pressed }) => [
              styles.createButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.createButtonText}>
              Create event
            </Text>
          </Pressable>

          {canManageOrganizationLinks(
            organization.role
          ) ? (
            <View style={styles.linksSection}>
              <LinksEditor
                disabled={isSavingLinks}
                onChange={setLinks}
                value={links}
              />

              <Pressable
                accessibilityRole="button"
                disabled={isSavingLinks}
                onPress={() => void saveLinks()}
                style={({ pressed }) => [
                  styles.saveLinksButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.saveLinksText}>
                  {isSavingLinks
                    ? 'Saving links…'
                    : 'Save links'}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.editorNote}>
              Owners and admins manage profile links. Editors can
              publish posts and events.
            </Text>
          )}

          <Text style={styles.sectionTitle}>
            Organization events
          </Text>

          {errorMessage ? (
            <Text
              accessibilityRole="alert"
              style={styles.error}
            >
              {errorMessage}
            </Text>
          ) : null}

          {events.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                No events yet.
              </Text>

              <Text style={styles.emptyMessage}>
                Create the first structured event for this
                organization.
              </Text>
            </View>
          ) : (
            events.map((event) => (
              <View key={event.id}>
                <EventCard
                  event={event}
                  onPress={(item) =>
                    router.push({
                      pathname: '/event/[id]',
                      params: {
                        id: item.id,
                      },
                    })
                  }
                />

                {event.canEdit ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: '/event/[id]/edit',
                        params: {
                          id: event.id,
                        },
                      })
                    }
                    style={({ pressed }) => [
                      styles.editButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.editText}>
                      Edit event
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={styles.readOnly}>
                    Created by another editor · read only
                  </Text>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaScreen>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },

    center: {
      flex: 1,
      padding: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },

    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },

    eyebrow: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.2,
      color: colors.textMuted,
    },

    title: {
      marginTop: spacing.xs,
      fontSize: 29,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    subtitle: {
      maxWidth: 330,
      marginTop: spacing.sm,
      fontSize: 14,
      lineHeight: 21,
      color: colors.textSecondary,
    },

    profileButton: {
      minHeight: 48,
      marginTop: spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.full,
      backgroundColor: colors.surface,
    },

    profileButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    profilePermissionNote: {
      marginTop: spacing.lg,
      fontSize: 11,
      lineHeight: 17,
      color: colors.textMuted,
    },

    createButton: {
      minHeight: 52,
      marginTop: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.full,
      backgroundColor: colors.textPrimary,
    },

    createButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.white,
    },

    linksSection: {
      marginTop: spacing.xxl,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
    },

    saveLinksButton: {
      minHeight: 44,
      marginTop: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.full,
      backgroundColor: colors.textPrimary,
    },

    saveLinksText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.white,
    },

    editorNote: {
      marginTop: spacing.lg,
      fontSize: 11,
      lineHeight: 17,
      color: colors.textMuted,
    },

    sectionTitle: {
      marginTop: spacing.xxl,
      marginBottom: spacing.md,
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    editButton: {
      minHeight: 40,
      marginTop: -spacing.sm,
      marginBottom: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },

    editText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    readOnly: {
      marginTop: -spacing.xs,
      marginBottom: spacing.lg,
      textAlign: 'center',
      fontSize: 11,
      color: colors.textMuted,
    },

    empty: {
      minHeight: 150,
      padding: spacing.lg,
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
    },

    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    emptyMessage: {
      marginTop: spacing.xs,
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary,
    },

    error: {
      marginBottom: spacing.md,
      fontSize: 13,
      color: colors.danger,
    },

    stateTitle: {
      fontSize: 20,
      fontWeight: '700',
      textAlign: 'center',
      color: colors.textPrimary,
    },

    stateMessage: {
      maxWidth: 290,
      marginTop: spacing.sm,
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
      color: colors.textSecondary,
    },

    pressed: {
      opacity: 0.55,
    },
  });
