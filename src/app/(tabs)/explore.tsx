import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  SafeAreaView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Avatar } from '../../components/Avatar';
import { EventCard } from '../../components/events/EventCard';
import { OrganizationAvatar } from '../../components/organizations/OrganizationAvatar';
import { colors, radius, spacing } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
} from '../../lib/recentSearches';
import {
  getSearchErrorMessage,
  getVartaDiscovery,
  MIN_SEARCH_CHARACTERS,
  normalizeSearchQuery,
  searchVarta,
} from '../../lib/search';
import { formatEventStart } from '../../lib/time';
import type { CampusEvent } from '../../types/event';
import type {
  DiscoveryResults,
  SearchEvent,
  SearchOrganization,
  SearchPerson,
  SearchResults,
} from '../../types/search';

type SearchStatus = 'idle' | 'searching' | 'ready' | 'error';
type DiscoveryStatus = 'loading' | 'ready' | 'error';

type ExploreItem =
  | { kind: 'discovery-event'; value: CampusEvent }
  | { kind: 'event'; value: SearchEvent }
  | { kind: 'organization'; value: SearchOrganization }
  | { kind: 'person'; value: SearchPerson };

type ExploreSection = {
  data: ExploreItem[];
  title: string;
};

const EMPTY_SEARCH_RESULTS: SearchResults = {
  events: [],
  organizations: [],
  people: [],
};

const EMPTY_DISCOVERY_RESULTS: DiscoveryResults = {
  events: [],
  organizations: [],
};

export default function ExploreScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const searchRequestId = useRef(0);
  const [discovery, setDiscovery] = useState(EMPTY_DISCOVERY_RESULTS);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [discoveryStatus, setDiscoveryStatus] =
    useState<DiscoveryStatus>('loading');
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [results, setResults] = useState(EMPTY_SEARCH_RESULTS);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchNonce, setSearchNonce] = useState(0);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle');
  const normalizedQuery = normalizeSearchQuery(query);
  const isSearching = searchStatus === 'searching';
  const isSearchMode = normalizedQuery.length >= MIN_SEARCH_CHARACTERS;

  const loadDiscovery = useCallback(async () => {
    if (!userId) {
      return;
    }

    setDiscoveryStatus('loading');
    setDiscoveryError(null);

    try {
      setDiscovery(await getVartaDiscovery(userId));
      setDiscoveryStatus('ready');
    } catch (error) {
      console.warn('[explore] Could not load discovery.', error);
      setDiscoveryError('Discovery is unavailable. Check your connection.');
      setDiscoveryStatus('error');
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) {
        return;
      }

      void loadDiscovery();
      void getRecentSearches(userId)
        .then(setRecentSearches)
        .catch(() => setRecentSearches([]));
    }, [loadDiscovery, userId])
  );

  useEffect(() => {
    const activeRequestId = searchRequestId.current + 1;
    searchRequestId.current = activeRequestId;

    if (!isSearchMode) {
      setResults(EMPTY_SEARCH_RESULTS);
      setSearchError(null);
      setSearchStatus('idle');
      return;
    }

    const controller = new AbortController();
    setSearchError(null);
    setSearchStatus('searching');
    const timer = setTimeout(() => {
      void searchVarta(normalizedQuery, controller.signal)
        .then((nextResults) => {
          if (searchRequestId.current !== activeRequestId) {
            return;
          }

          setResults(nextResults);
          setSearchStatus('ready');
        })
        .catch((error: unknown) => {
          if (
            controller.signal.aborted ||
            searchRequestId.current !== activeRequestId
          ) {
            return;
          }

          console.warn('[explore] Search request failed.', error);
          setSearchError(getSearchErrorMessage());
          setSearchStatus('error');
        });
    }, 320);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isSearchMode, normalizedQuery, searchNonce]);

  const sections = useMemo<ExploreSection[]>(() => {
    if (isSearchMode) {
      return [
        {
          data: results.people.map((value) => ({ kind: 'person', value })),
          title: 'Students',
        },
        {
          data: results.organizations.map((value) => ({
            kind: 'organization',
            value,
          })),
          title: 'Organizations',
        },
        {
          data: results.events.map((value) => ({ kind: 'event', value })),
          title: 'Upcoming events',
        },
      ].filter((section) => section.data.length > 0) as ExploreSection[];
    }

    if (normalizedQuery.length > 0) {
      return [];
    }

    return [
      {
        data: discovery.organizations.map((value) => ({
          kind: 'organization',
          value,
        })),
        title: 'Official organizations',
      },
      {
        data: discovery.events.map((value) => ({
          kind: 'discovery-event',
          value,
        })),
        title: 'Coming up',
      },
    ].filter((section) => section.data.length > 0) as ExploreSection[];
  }, [discovery, isSearchMode, normalizedQuery.length, results]);

  const rememberQuery = useCallback(
    (value: string) => {
      if (!userId) {
        return;
      }

      void addRecentSearch(userId, value)
        .then(setRecentSearches)
        .catch(() => undefined);
    },
    [userId]
  );

  const openItem = useCallback(
    (item: ExploreItem) => {
      if (isSearchMode) {
        rememberQuery(normalizedQuery);
      }

      Keyboard.dismiss();

      if (item.kind === 'person') {
        router.push({ pathname: '/user/[id]', params: { id: item.value.id } });
      } else if (item.kind === 'organization') {
        router.push({
          pathname: '/organization/[id]',
          params: { id: item.value.id },
        });
      } else {
        router.push({
          pathname: '/event/[id]',
          params: { id: item.value.id },
        });
      }
    },
    [isSearchMode, normalizedQuery, rememberQuery, router]
  );

  const clearHistory = useCallback(() => {
    if (!userId) {
      return;
    }

    setRecentSearches([]);
    void clearRecentSearches(userId).catch(() => undefined);
  }, [userId]);

  const renderItem = ({ item }: { item: ExploreItem }) => {
    if (item.kind === 'person') {
      return (
        <PersonResult
          person={item.value}
          onPress={() => openItem(item)}
        />
      );
    }

    if (item.kind === 'organization') {
      return (
        <OrganizationResult
          organization={item.value}
          onPress={() => openItem(item)}
        />
      );
    }

    if (item.kind === 'event') {
      return (
        <EventResult event={item.value} onPress={() => openItem(item)} />
      );
    }

    return (
      <EventCard event={item.value} onPress={() => openItem(item)} />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <SectionList
        contentContainerStyle={[
          styles.content,
          sections.length === 0 && styles.emptyContent,
        ]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => `${item.kind}:${item.value.id}`}
        ListEmptyComponent={
          <ExploreEmptyState
            discoveryError={discoveryError}
            discoveryStatus={discoveryStatus}
            isSearchMode={isSearchMode}
            normalizedQuery={normalizedQuery}
            onDiscoveryRetry={() => void loadDiscovery()}
            onSearchRetry={() => setSearchNonce((current) => current + 1)}
            searchError={searchError}
            searchStatus={searchStatus}
          />
        }
        ListHeaderComponent={
          <View>
            <Text style={styles.brand}>VĀRTĀ</Text>
            <Text style={styles.heading}>Find your campus.</Text>
            <View style={styles.searchField}>
              <SymbolView
                name={{ android: 'search', ios: 'magnifyingglass', web: 'search' }}
                size={20}
                tintColor={colors.textMuted}
              />
              <TextInput
                accessibilityLabel="Search students, organizations, and events"
                autoCorrect={false}
                maxLength={80}
                onChangeText={setQuery}
                onSubmitEditing={() => rememberQuery(normalizedQuery)}
                placeholder="Students, organizations, events"
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
                selectionColor={colors.textPrimary}
                style={styles.searchInput}
                value={query}
              />
              {isSearching ? (
                <ActivityIndicator color={colors.textSecondary} size="small" />
              ) : query.length > 0 ? (
                <Pressable
                  accessibilityLabel="Clear search"
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => setQuery('')}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <SymbolView
                    name={{ android: 'cancel', ios: 'xmark.circle.fill', web: 'cancel' }}
                    size={20}
                    tintColor={colors.textMuted}
                  />
                </Pressable>
              ) : null}
            </View>

            {searchError && sections.length > 0 ? (
              <Text accessibilityRole="alert" style={styles.inlineError}>
                {searchError}
              </Text>
            ) : null}

            {!isSearchMode &&
            discoveryError &&
            sections.length > 0 ? (
              <Text accessibilityRole="alert" style={styles.inlineError}>
                {discoveryError}
              </Text>
            ) : null}

            {normalizedQuery.length === 0 && recentSearches.length > 0 ? (
              <View style={styles.recentBlock}>
                <View style={styles.recentHeadingRow}>
                  <Text style={styles.recentHeading}>Recent searches</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={clearHistory}
                    style={({ pressed }) => pressed && styles.pressed}
                  >
                    <Text style={styles.clearHistory}>Clear</Text>
                  </Pressable>
                </View>
                <View style={styles.recentChips}>
                  {recentSearches.map((item) => (
                    <Pressable
                      accessibilityRole="button"
                      key={item.toLocaleLowerCase()}
                      onPress={() => setQuery(item)}
                      style={({ pressed }) => [
                        styles.recentChip,
                        pressed && styles.pressed,
                      ]}
                    >
                      <SymbolView
                        name={{ android: 'history', ios: 'clock', web: 'history' }}
                        size={13}
                        tintColor={colors.textSecondary}
                      />
                      <Text numberOfLines={1} style={styles.recentChipText}>
                        {item}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {normalizedQuery.length === 0 ? (
              <View style={styles.discoveryHeading}>
                <Text style={styles.eyebrow}>DISCOVER</Text>
                <Text style={styles.discoveryTitle}>Around your university</Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        sections={sections}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
      />
    </SafeAreaView>
  );
}

function PersonResult({
  onPress,
  person,
}: {
  onPress: () => void;
  person: SearchPerson;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.resultRow, pressed && styles.rowPressed]}
    >
      <Avatar
        fullName={person.full_name}
        size={48}
        uri={person.avatarUrl}
        verified={person.is_verified}
      />
      <View style={styles.resultCopy}>
        <Text numberOfLines={1} style={styles.resultTitle}>
          {person.full_name}
        </Text>
        <Text numberOfLines={1} style={styles.resultHandle}>
          @{person.username}
        </Text>
        <Text numberOfLines={1} style={styles.resultMeta}>
          {person.branch} · Year {person.year} · {person.institute_short_name}
        </Text>
      </View>
      <Chevron />
    </Pressable>
  );
}

function OrganizationResult({
  onPress,
  organization,
}: {
  onPress: () => void;
  organization: SearchOrganization;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.resultRow, pressed && styles.rowPressed]}
    >
      <OrganizationAvatar
        name={organization.name}
        size={48}
        uri={organization.avatarUrl}
      />
      <View style={styles.resultCopy}>
        <View style={styles.verifiedRow}>
          <Text numberOfLines={1} style={styles.resultTitle}>
            {organization.name}
          </Text>
          {organization.is_verified ? (
            <SymbolView
              name={{ android: 'verified', ios: 'checkmark.seal.fill', web: 'verified' }}
              size={15}
              tintColor={colors.textPrimary}
            />
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.resultHandle}>
          @{organization.slug}
        </Text>
        <Text numberOfLines={1} style={styles.resultMeta}>
          {organization.institute_short_name || 'University-wide'}
        </Text>
      </View>
      <Chevron />
    </Pressable>
  );
}

function EventResult({
  event,
  onPress,
}: {
  event: SearchEvent;
  onPress: () => void;
}) {
  const date = new Date(event.starts_at);
  const month = new Intl.DateTimeFormat('en', { month: 'short' })
    .format(date)
    .toUpperCase();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.resultRow, pressed && styles.rowPressed]}
    >
      <View style={styles.dateTile}>
        <Text style={styles.dateMonth}>{month}</Text>
        <Text style={styles.dateDay}>{date.getDate()}</Text>
      </View>
      <View style={styles.resultCopy}>
        <Text numberOfLines={2} style={styles.resultTitle}>
          {event.title}
        </Text>
        <View style={styles.verifiedRow}>
          <Text numberOfLines={1} style={styles.resultHandle}>
            {event.organization_name}
          </Text>
          {event.organization_is_verified ? (
            <SymbolView
              name={{ android: 'verified', ios: 'checkmark.seal.fill', web: 'verified' }}
              size={13}
              tintColor={colors.textSecondary}
            />
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.resultMeta}>
          {formatEventStart(event.starts_at)}
          {event.location ? ` · ${event.location}` : ''}
        </Text>
      </View>
      <Chevron />
    </Pressable>
  );
}

function Chevron() {
  return (
    <SymbolView
      name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' }}
      size={15}
      tintColor={colors.textMuted}
    />
  );
}

function ExploreEmptyState({
  discoveryError,
  discoveryStatus,
  isSearchMode,
  normalizedQuery,
  onDiscoveryRetry,
  onSearchRetry,
  searchError,
  searchStatus,
}: {
  discoveryError: string | null;
  discoveryStatus: DiscoveryStatus;
  isSearchMode: boolean;
  normalizedQuery: string;
  onDiscoveryRetry: () => void;
  onSearchRetry: () => void;
  searchError: string | null;
  searchStatus: SearchStatus;
}) {
  if (isSearchMode && searchStatus === 'searching') {
    return null;
  }

  if (isSearchMode && searchStatus === 'error') {
    return (
      <StateCard
        actionLabel="Try again"
        message={searchError ?? getSearchErrorMessage()}
        onAction={onSearchRetry}
        title="Search paused"
      />
    );
  }

  if (isSearchMode && searchStatus === 'ready') {
    return (
      <StateCard
        message="Try a full name, username, organization, or event title."
        title="No campus matches"
      />
    );
  }

  if (normalizedQuery.length > 0) {
    return (
      <StateCard
        message={`Enter at least ${MIN_SEARCH_CHARACTERS} characters to search.`}
        title="Keep typing"
      />
    );
  }

  if (discoveryStatus === 'loading') {
    return (
      <View accessibilityLabel="Loading discovery" style={styles.loadingState}>
        <ActivityIndicator color={colors.textSecondary} />
      </View>
    );
  }

  if (discoveryStatus === 'error') {
    return (
      <StateCard
        actionLabel="Try again"
        message={discoveryError ?? 'Check your connection and try again.'}
        onAction={onDiscoveryRetry}
        title="Discovery paused"
      />
    );
  }

  return (
    <StateCard
      message="Official organizations and upcoming events will appear here."
      title="Campus is quiet for now"
    />
  );
}

function StateCard({
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
  return (
    <View style={styles.stateCard}>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.retry}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  emptyContent: { flexGrow: 1 },
  brand: {
    marginTop: spacing.lg,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.4,
    color: colors.textSecondary,
  },
  heading: {
    marginTop: spacing.sm,
    fontSize: 29,
    fontWeight: '700',
    letterSpacing: -0.7,
    color: colors.textPrimary,
  },
  searchField: {
    minHeight: 52,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    minHeight: 50,
    paddingVertical: 0,
    fontSize: 15,
    color: colors.textPrimary,
  },
  recentBlock: { marginTop: spacing.lg },
  inlineError: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    fontSize: 12,
    lineHeight: 18,
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  recentHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recentHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  clearHistory: {
    paddingVertical: spacing.xs,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  recentChips: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  recentChip: {
    maxWidth: '100%',
    minHeight: 34,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  recentChipText: { fontSize: 12, color: colors.textSecondary },
  discoveryHeading: { marginTop: spacing.xl },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
    color: colors.textMuted,
  },
  discoveryTitle: {
    marginTop: spacing.xs,
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionTitle: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  resultRow: {
    minHeight: 76,
    marginBottom: spacing.sm,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  rowPressed: { backgroundColor: colors.borderSubtle },
  resultCopy: { flex: 1, minWidth: 0 },
  resultTitle: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  resultHandle: {
    flexShrink: 1,
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
  },
  resultMeta: {
    marginTop: 3,
    fontSize: 11,
    color: colors.textMuted,
  },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateTile: {
    width: 48,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.textPrimary,
  },
  dateMonth: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.textMuted,
  },
  dateDay: { fontSize: 19, fontWeight: '700', color: colors.white },
  loadingState: {
    minHeight: 170,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateCard: {
    minHeight: 170,
    padding: spacing.lg,
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
    maxWidth: 290,
    marginTop: spacing.sm,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  retry: {
    marginTop: spacing.md,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  pressed: { opacity: 0.55 },
});
