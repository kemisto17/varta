import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Avatar } from '../../../components/Avatar';
import { SafeAreaScreen } from '../../../components/SafeAreaScreen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { radius, spacing, type ThemeColors } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { useThemedStyles } from '../../../hooks/useTheme';
import { isUuid } from '../../../lib/identifiers';
import {
  getOrganizationById,
  getOrganizationMembers,
  removeOrganizationMember,
  searchOrganizationMemberCandidates,
  setOrganizationMemberRole,
} from '../../../lib/organizations';
import type {
  OrganizationMember,
  OrganizationMemberCandidate,
  OrganizationMemberRole,
} from '../../../types/organization';

type ScreenStatus = 'loading' | 'ready' | 'unavailable' | 'error';

export default function OrganizationMembersScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const { session } = useAuth();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const organizationId = Array.isArray(params.id) ? params.id[0] : params.id;
  const userId = session?.user.id ?? null;
  const requestIdRef = useRef(0);
  const searchControllerRef = useRef<AbortController | null>(null);
  const pendingUserIdRef = useRef<string | null>(null);

  const [organizationName, setOrganizationName] = useState('');
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] =
    useState<OrganizationMemberCandidate[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [status, setStatus] = useState<ScreenStatus>('loading');

  useEffect(() => {
    requestIdRef.current += 1;
    searchControllerRef.current?.abort();
    pendingUserIdRef.current = null;
    setOrganizationName('');
    setMembers([]);
    setPendingUserId(null);
    setSearchQuery('');
    setSearchResults([]);
    setSearchMessage(null);
    setIsSearching(false);
    setStatus('loading');
  }, [organizationId, userId]);

  const loadPage = useCallback(async () => {
    if (!isUuid(organizationId) || !userId) {
      setStatus('unavailable');
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setStatus('loading');

    try {
      const organization = await getOrganizationById(organizationId, userId);

      if (requestIdRef.current !== requestId) {
        return;
      }

      if (!organization || organization.role !== 'owner') {
        setStatus('unavailable');
        return;
      }

      const nextMembers = await getOrganizationMembers(organizationId);

      if (requestIdRef.current !== requestId) {
        return;
      }

      setOrganizationName(organization.name);
      setMembers(nextMembers);
      setStatus('ready');
    } catch (error) {
      if (requestIdRef.current !== requestId) {
        return;
      }

      console.warn('[organization-members] Could not load members.', error);
      setStatus('error');
    }
  }, [organizationId, userId]);

  useFocusEffect(
    useCallback(() => {
      void loadPage();

      return () => {
        requestIdRef.current += 1;
        searchControllerRef.current?.abort();
      };
    }, [loadPage])
  );

  const search = async () => {
    const normalizedQuery = searchQuery.trim();

    if (normalizedQuery.length < 2) {
      setSearchResults([]);
      setSearchMessage('Enter at least 2 characters.');
      return;
    }

    searchControllerRef.current?.abort();
    const controller = new AbortController();
    searchControllerRef.current = controller;
    setIsSearching(true);
    setSearchMessage(null);

    try {
      const candidates = await searchOrganizationMemberCandidates(
        normalizedQuery,
        controller.signal
      );

      if (controller.signal.aborted) {
        return;
      }

      const memberIds = new Set(members.map((member) => member.id));
      const nextResults = candidates.filter(
        (candidate) => candidate.id !== userId && !memberIds.has(candidate.id)
      );

      setSearchResults(nextResults);
      setSearchMessage(
        nextResults.length === 0 ? 'No eligible students found.' : null
      );
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      console.warn('[organization-members] Could not search students.', error);
      setSearchResults([]);
      setSearchMessage('Search is unavailable. Check your connection and try again.');
    } finally {
      if (!controller.signal.aborted) {
        setIsSearching(false);
      }
    }
  };

  const changeRole = async (
    person: OrganizationMember | OrganizationMemberCandidate,
    role: OrganizationMemberRole
  ) => {
    if (!isUuid(organizationId) || pendingUserIdRef.current) {
      return;
    }

    pendingUserIdRef.current = person.id;
    setPendingUserId(person.id);

    try {
      await setOrganizationMemberRole(organizationId, person.id, role);
      setMembers((current) => {
        const existingMember = current.some((member) => member.id === person.id);

        return existingMember
          ? current.map((member) =>
              member.id === person.id ? { ...member, role } : member
            )
          : [
              ...current,
              {
                fullName: person.fullName,
                id: person.id,
                role,
                username: person.username,
              },
            ];
      });
      setSearchResults((current) =>
        current.filter((candidate) => candidate.id !== person.id)
      );
    } catch (error) {
      console.warn('[organization-members] Could not change role.', error);
      Alert.alert(
        'Could not update role',
        'Check your connection and confirm you are still the organization owner.'
      );
    } finally {
      pendingUserIdRef.current = null;
      setPendingUserId(null);
    }
  };

  const removeMember = async (member: OrganizationMember) => {
    if (!isUuid(organizationId) || pendingUserIdRef.current) {
      return;
    }

    pendingUserIdRef.current = member.id;
    setPendingUserId(member.id);

    try {
      await removeOrganizationMember(organizationId, member.id);
      setMembers((current) => current.filter((item) => item.id !== member.id));
    } catch (error) {
      console.warn('[organization-members] Could not remove member.', error);
      Alert.alert(
        'Could not remove member',
        'Check your connection and confirm you are still the organization owner.'
      );
    } finally {
      pendingUserIdRef.current = null;
      setPendingUserId(null);
    }
  };

  const confirmRemove = (member: OrganizationMember) => {
    Alert.alert(
      `Remove ${member.fullName}?`,
      `They will lose ${member.role} access to ${organizationName}.`,
      [
        { style: 'cancel', text: 'Cancel' },
        {
          style: 'destructive',
          text: 'Remove',
          onPress: () => void removeMember(member),
        },
      ]
    );
  };

  return (
    <SafeAreaScreen style={styles.safeArea}>
      <ScreenHeader title="Team access" />

      {status === 'loading' ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      ) : status === 'unavailable' ? (
        <View style={styles.state}>
          <Text style={styles.stateTitle}>Owner access required</Text>
          <Text style={styles.stateMessage}>
            Only the organization owner can manage admins and editors.
          </Text>
        </View>
      ) : status === 'error' ? (
        <View style={styles.state}>
          <Text style={styles.stateTitle}>Could not load team access</Text>
          <Text style={styles.stateMessage}>
            Check your connection and try again.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void loadPage()}
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.eyebrow}>ORGANIZATION OWNER</Text>
          <Text style={styles.title}>{organizationName}</Text>
          <Text style={styles.subtitle}>
            Admins can manage the profile, links, posts, and events. Editors can
            publish posts and events.
          </Text>

          <Text style={styles.sectionTitle}>Admins and editors</Text>

          {members.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No team members yet</Text>
              <Text style={styles.emptyMessage}>
                Search for a verified student below to give them access.
              </Text>
            </View>
          ) : (
            members.map((member) => {
              const isPending = pendingUserId === member.id;

              return (
                <View key={member.id} style={styles.personCard}>
                  <View style={styles.personHeader}>
                    <Avatar fullName={member.fullName} size={44} verified />
                    <View style={styles.identity}>
                      <Text numberOfLines={1} style={styles.name}>
                        {member.fullName}
                      </Text>
                      <Text numberOfLines={1} style={styles.username}>
                        @{member.username}
                      </Text>
                    </View>
                    {isPending ? (
                      <ActivityIndicator color={colors.textSecondary} />
                    ) : null}
                  </View>

                  <View style={styles.actions}>
                    {(['admin', 'editor'] as const).map((role) => (
                      <Pressable
                        accessibilityLabel={`Make ${member.fullName} an ${role}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: member.role === role }}
                        disabled={pendingUserId !== null || member.role === role}
                        key={role}
                        onPress={() => void changeRole(member, role)}
                        style={({ pressed }) => [
                          styles.roleButton,
                          member.role === role && styles.roleButtonSelected,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.roleText,
                            member.role === role && styles.roleTextSelected,
                          ]}
                        >
                          {role === 'admin' ? 'Admin' : 'Editor'}
                        </Text>
                      </Pressable>
                    ))}
                    <Pressable
                      accessibilityLabel={`Remove ${member.fullName} from the organization team`}
                      accessibilityRole="button"
                      disabled={pendingUserId !== null}
                      onPress={() => confirmRemove(member)}
                      style={({ pressed }) => [
                        styles.removeButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.removeText}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}

          <Text style={styles.sectionTitle}>Add a student</Text>
          <View style={styles.searchRow}>
            <TextInput
              accessibilityLabel="Search verified students"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(value) => {
                searchControllerRef.current?.abort();
                setSearchQuery(value);
                setSearchResults([]);
                setSearchMessage(null);
                setIsSearching(false);
              }}
              onSubmitEditing={() => void search()}
              placeholder="Name or username"
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              style={styles.searchInput}
              value={searchQuery}
            />
            <Pressable
              accessibilityRole="button"
              disabled={isSearching}
              onPress={() => void search()}
              style={({ pressed }) => [
                styles.searchButton,
                pressed && styles.pressed,
              ]}
            >
              {isSearching ? (
                <ActivityIndicator color={colors.primaryActionForeground} />
              ) : (
                <Text style={styles.searchButtonText}>Search</Text>
              )}
            </Pressable>
          </View>

          {searchMessage ? (
            <Text accessibilityRole="alert" style={styles.searchMessage}>
              {searchMessage}
            </Text>
          ) : null}

          {searchResults.map((candidate) => {
            const isPending = pendingUserId === candidate.id;

            return (
              <View key={candidate.id} style={styles.personCard}>
                <View style={styles.personHeader}>
                  <Avatar fullName={candidate.fullName} size={44} verified />
                  <View style={styles.identity}>
                    <Text numberOfLines={1} style={styles.name}>
                      {candidate.fullName}
                    </Text>
                    <Text numberOfLines={1} style={styles.username}>
                      @{candidate.username}
                    </Text>
                  </View>
                  {isPending ? (
                    <ActivityIndicator color={colors.textSecondary} />
                  ) : null}
                </View>
                <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={pendingUserId !== null}
                    onPress={() => void changeRole(candidate, 'admin')}
                    style={({ pressed }) => [
                      styles.addButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.addButtonText}>Add as admin</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={pendingUserId !== null}
                    onPress={() => void changeRole(candidate, 'editor')}
                    style={({ pressed }) => [
                      styles.addButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.addButtonText}>Add as editor</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaScreen>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    state: {
      flex: 1,
      padding: spacing.lg,
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
      maxWidth: 300,
      marginTop: spacing.sm,
      fontSize: 14,
      lineHeight: 21,
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
      backgroundColor: colors.primaryActionBackground,
    },
    retryText: { fontWeight: '700', color: colors.primaryActionForeground },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
    eyebrow: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.2,
      color: colors.textMuted,
    },
    title: {
      marginTop: spacing.xs,
      fontSize: 28,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    subtitle: {
      marginTop: spacing.sm,
      fontSize: 14,
      lineHeight: 21,
      color: colors.textSecondary,
    },
    sectionTitle: {
      marginTop: spacing.xxl,
      marginBottom: spacing.md,
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    emptyCard: {
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
    },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
    emptyMessage: {
      marginTop: spacing.xs,
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary,
    },
    personCard: {
      marginBottom: spacing.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
    },
    personHeader: { flexDirection: 'row', alignItems: 'center' },
    identity: { flex: 1, minWidth: 0, marginLeft: spacing.sm },
    name: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    username: { marginTop: 2, fontSize: 12, color: colors.textMuted },
    actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    roleButton: {
      minHeight: 38,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.full,
    },
    roleButtonSelected: { backgroundColor: colors.primaryActionBackground },
    roleText: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
    roleTextSelected: { color: colors.primaryActionForeground },
    removeButton: {
      minHeight: 38,
      marginLeft: 'auto',
      paddingHorizontal: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeText: { fontSize: 12, fontWeight: '700', color: colors.danger },
    searchRow: { flexDirection: 'row', gap: spacing.sm },
    searchInput: {
      flex: 1,
      minHeight: 48,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.full,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
    },
    searchButton: {
      minWidth: 88,
      minHeight: 48,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.full,
      backgroundColor: colors.primaryActionBackground,
    },
    searchButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primaryActionForeground,
    },
    searchMessage: {
      marginTop: spacing.md,
      fontSize: 13,
      color: colors.textSecondary,
    },
    addButton: {
      flex: 1,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.full,
    },
    addButtonText: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
    pressed: { opacity: 0.55 },
  });
