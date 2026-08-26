import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, type ThemeColors } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useTheme';
import type { StructuredLink } from '../../lib/links';

export function StructuredLinks({
  links,
  ownerName,
}: {
  links: StructuredLink[];
  ownerName: string;
}) {
  const { colors, styles } = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  if (links.length === 0) {
    return null;
  }

  const openLink = async (link: StructuredLink) => {
    try {
      await Linking.openURL(link.url);
    } catch (error) {
      console.warn('[structured-links] Could not open URL.', error);
      Alert.alert(
        'Could not open link',
        'This link is unavailable right now. Check the address and try again.'
      );
    }
  };

  return (
    <>
      <Pressable
        accessibilityLabel={`Open ${links.length} links from ${ownerName}`}
        accessibilityRole="button"
        onPress={() => setVisible(true)}
        style={({ pressed }) => [styles.entry, pressed && styles.pressed]}
      >
        <SymbolView
          name={{ android: 'link', ios: 'link', web: 'link' }}
          size={15}
          tintColor={colors.textSecondary}
        />
        <Text style={styles.entryText}>Links · {links.length}</Text>
        <SymbolView
          name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' }}
          size={14}
          tintColor={colors.textMuted}
        />
      </Pressable>

      <Modal
        animationType="slide"
        onRequestClose={() => setVisible(false)}
        statusBarTranslucent
        transparent
        visible={visible}
      >
        <View style={[styles.overlay, { paddingTop: insets.top }]}>
          <Pressable
            accessibilityLabel="Close links"
            accessibilityRole="button"
            onPress={() => setVisible(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            accessibilityViewIsModal
            style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}
          >
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>LINKS</Text>
                <Text numberOfLines={2} style={styles.title}>{ownerName}</Text>
              </View>
              <Pressable
                accessibilityLabel="Close links"
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setVisible(false)}
                style={({ pressed }) => [styles.close, pressed && styles.pressed]}
              >
                <SymbolView
                  name={{ android: 'close', ios: 'xmark', web: 'close' }}
                  size={19}
                  tintColor={colors.textSecondary}
                />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {links.map((link) => (
                <Pressable
                  accessibilityRole="link"
                  key={link.id}
                  onPress={() => void openLink(link)}
                  style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
                >
                  <View style={styles.linkCopy}>
                    <Text style={styles.linkLabel}>{link.label}</Text>
                    <Text numberOfLines={1} style={styles.linkUrl}>{link.url}</Text>
                  </View>
                  <SymbolView
                    name={{ android: 'open_in_new', ios: 'arrow.up.right', web: 'open_in_new' }}
                    size={17}
                    tintColor={colors.textSecondary}
                  />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  entry: {
    minHeight: 36,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  entryText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    maxHeight: '76%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.surface,
  },
  handle: {
    width: 36,
    height: 4,
    alignSelf: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  header: { marginTop: spacing.lg, flexDirection: 'row', alignItems: 'flex-start' },
  headerCopy: { flex: 1, paddingRight: spacing.md },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.25, color: colors.textMuted },
  title: { marginTop: spacing.xs, fontSize: 24, lineHeight: 30, fontWeight: '700', color: colors.textPrimary },
  close: { width: 40, height: 40, marginTop: -8, alignItems: 'center', justifyContent: 'center' },
  linkRow: {
    minHeight: 68,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkCopy: { flex: 1, paddingRight: spacing.md },
  linkLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  linkUrl: { marginTop: 3, fontSize: 11, color: colors.textMuted },
  pressed: { opacity: 0.55 },
});
