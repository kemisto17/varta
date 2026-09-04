import { useEffect, useRef, useState, type Ref } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { spacing, type ThemeColors } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useThemedStyles } from '../hooks/useTheme';
import { getActiveMention, insertMention, type MentionSelection } from '../lib/mentionText';
import { searchMentionSuggestions, type MentionSuggestion } from '../lib/mentions';
import { Avatar } from './Avatar';

type Props = TextInputProps & {
  ref?: Ref<TextInput>;
  containerStyle?: StyleProp<ViewStyle>;
  suggestionsAbove?: boolean;
};

export function MentionInput({ ref, containerStyle, suggestionsAbove = false, value = '', onChangeText, onSelectionChange, onFocus, onBlur, editable = true, maxLength, ...props }: Props) {
  const { colors, styles } = useThemedStyles(createStyles);
  const { session } = useAuth();
  const inputRef = useRef<TextInput | null>(null);
  const [focused, setFocused] = useState(false);
  const [selection, setSelection] = useState<MentionSelection>({ start: 0, end: 0 });
  const [forcedSelection, setForcedSelection] = useState<MentionSelection>();
  const [result, setResult] = useState<{ key: string; people: MentionSuggestion[]; error?: boolean }>();
  const [retry, setRetry] = useState(0);
  const active = focused && editable ? getActiveMention(value, selection) : null;
  const userId = session?.user.id;
  const query = active?.query;
  const key = userId && query !== undefined ? `${userId}:${query}` : null;

  useEffect(() => {
    setResult(undefined);
    if (!key || !userId || query === undefined) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void searchMentionSuggestions(query, userId, controller.signal).then((people) => {
        if (!controller.signal.aborted) setResult({ key, people });
      }).catch(() => {
        if (!controller.signal.aborted) setResult({ key, people: [], error: true });
      });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key, query, userId, retry]);

  const choose = (person: MentionSuggestion) => {
    if (!active) return;
    const next = insertMention(value, active, person.username, maxLength);
    if (!next) return;
    onChangeText?.(next.value);
    setSelection(next.selection);
    setForcedSelection(next.selection);
    inputRef.current?.focus();
  };

  const picker = key && active ? (
    <View accessibilityLabel="Mention suggestions" style={styles.picker}>
      {result?.key !== key ? <ActivityIndicator style={styles.status} color={colors.textSecondary} /> : result.error ? (
        <Pressable accessibilityRole="button" onPress={() => { setResult(undefined); setRetry((count) => count + 1); }} style={styles.status}>
          <Text style={styles.meta}>Could not load people. Retry</Text>
        </Pressable>
      ) : result.people.length === 0 ? <Text style={[styles.meta, styles.status]}>No people found</Text> : (
        <ScrollView keyboardShouldPersistTaps="always" nestedScrollEnabled style={styles.list}>
          {result.people.map((person) => {
            const fits = insertMention(value, active, person.username, maxLength) !== null;
            return (
              <Pressable key={person.id} accessibilityRole="button" accessibilityLabel={`Mention ${person.fullName}, @${person.username}`} disabled={!fits} onPress={() => choose(person)} style={({ pressed }) => [styles.row, (pressed || !fits) && styles.dimmed]}>
                <Avatar fullName={person.fullName} uri={person.avatarUrl} size={32} />
                <View style={styles.copy}>
                  <Text numberOfLines={1} style={styles.name}>{person.fullName}</Text>
                  <Text numberOfLines={1} style={styles.meta}>@{person.username}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  ) : null;

  return (
    <View style={containerStyle}>
      {suggestionsAbove ? picker : null}
      <TextInput {...props} editable={editable} maxLength={maxLength} value={value}
        ref={(input) => {
          inputRef.current = input;
          if (typeof ref === 'function') ref(input);
          else if (ref) ref.current = input;
        }}
        selection={forcedSelection}
        onChangeText={(text) => { setForcedSelection(undefined); onChangeText?.(text); }}
        onSelectionChange={(event) => {
          setSelection(event.nativeEvent.selection);
          setForcedSelection(undefined);
          onSelectionChange?.(event);
        }}
        onFocus={(event) => { setFocused(true); onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); onBlur?.(event); }}
      />
      {!suggestionsAbove ? picker : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  picker: { marginVertical: spacing.xs, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: 8, backgroundColor: colors.surface, overflow: 'hidden' },
  list: { maxHeight: 168 },
  row: { minHeight: 56, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  copy: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textSecondary },
  status: { padding: spacing.md, minHeight: 48 },
  dimmed: { opacity: 0.5 },
});
