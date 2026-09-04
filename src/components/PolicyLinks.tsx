import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { POLICY_URLS } from '../constants/policies';
import { spacing, type ThemeColors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useTheme';

export function openPolicy(url: string) {
  void Linking.openURL(url).catch(() => Alert.alert('Could not open page', 'Please check your connection and try again.'));
}

export function PolicyLinks() {
  const { styles } = useThemedStyles(createStyles);
  return <View style={styles.links}>
    {[
      ['Privacy Policy', POLICY_URLS.privacy],
      ['Terms of Use', POLICY_URLS.terms],
      ['Child Safety Standards', POLICY_URLS.childSafety],
      ['Request account deletion', POLICY_URLS.deletion],
    ].map(([label, url]) => <Pressable key={url} accessibilityRole="link" onPress={() => openPolicy(url)} style={styles.link}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>)}
  </View>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md },
  link: { minHeight: 44, justifyContent: 'center', maxWidth: '100%' },
  text: { fontSize: 13, lineHeight: 19, textDecorationLine: 'underline', color: colors.textSecondary },
});
