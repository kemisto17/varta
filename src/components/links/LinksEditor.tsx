import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { radius, spacing, type ThemeColors } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useTheme';
import {
  MAX_STRUCTURED_LINKS,
  type StructuredLinkDraft,
} from '../../lib/links';

export function LinksEditor({
  disabled = false,
  onChange,
  value,
}: {
  disabled?: boolean;
  onChange: (links: StructuredLinkDraft[]) => void;
  value: StructuredLinkDraft[];
}) {
  const { colors, styles } = useThemedStyles(createStyles);

  const updateLink = (
    index: number,
    field: keyof StructuredLinkDraft,
    nextValue: string
  ) => {
    onChange(
      value.map((link, linkIndex) =>
        linkIndex === index ? { ...link, [field]: nextValue } : link
      )
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Links</Text>
          <Text style={styles.subtitle}>Websites, portfolios and social profiles.</Text>
        </View>
        <Text style={styles.count}>{value.length}/{MAX_STRUCTURED_LINKS}</Text>
      </View>

      {value.map((link, index) => (
        <View key={index} style={styles.linkCard}>
          <View style={styles.rowHeader}>
            <Text style={styles.linkNumber}>LINK {index + 1}</Text>
            <Pressable
              accessibilityLabel={`Remove link ${index + 1}`}
              accessibilityRole="button"
              disabled={disabled}
              hitSlop={8}
              onPress={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <SymbolView
                name={{ android: 'delete_outline', ios: 'trash', web: 'delete_outline' }}
                size={17}
                tintColor={colors.danger}
              />
            </Pressable>
          </View>
          <TextInput
            autoCapitalize="words"
            editable={!disabled}
            maxLength={40}
            onChangeText={(text) => updateLink(index, 'label', text)}
            placeholder="Label, e.g. Portfolio"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={link.label}
          />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!disabled}
            keyboardType="url"
            onChangeText={(text) => updateLink(index, 'url', text)}
            placeholder="example.com/your-name"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={link.url}
          />
        </View>
      ))}

      {value.length < MAX_STRUCTURED_LINKS ? (
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => onChange([...value, { label: '', url: '' }])}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        >
          <SymbolView
            name={{ android: 'add', ios: 'plus', web: 'add' }}
            size={17}
            tintColor={colors.textPrimary}
          />
          <Text style={styles.addLabel}>Add link</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { gap: spacing.md },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start' },
  headingCopy: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  subtitle: { marginTop: 3, fontSize: 11, lineHeight: 16, color: colors.textMuted },
  count: { marginLeft: spacing.md, fontSize: 11, color: colors.textMuted },
  linkCard: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkNumber: { fontSize: 9, fontWeight: '800', letterSpacing: 1.1, color: colors.textMuted },
  input: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  addButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  addLabel: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  pressed: { opacity: 0.55 },
});
