import { useEffect, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { usePathname } from 'expo-router';
import { TERMS_SECTIONS, TERMS_VERSION } from '../constants/policies';
import { spacing, type ThemeColors } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useThemedStyles } from '../hooks/useTheme';
import { supabase } from '../lib/supabase';
import { SafeAreaScreen } from './SafeAreaScreen';
import { PrimaryButton } from './auth/PrimaryButton';
import { PolicyLinks } from './PolicyLinks';

export function TermsAcceptanceGate({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const pathname = usePathname();
  const userId = session?.user.id;
  const { colors, styles } = useThemedStyles(createStyles);
  const [result, setResult] = useState<{ userId: string; accepted: boolean }>();
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setResult(undefined); setError(null); setAgreed(false);
    if (userId) {
      void Promise.resolve(supabase.rpc('has_accepted_current_terms')).then(({ data, error }) => {
        if (!active) return;
        if (error) setError('Could not check your terms acceptance. Please try again.');
        else setResult({ userId, accepted: data === true });
      }).catch(() => {
        if (active) setError('Could not check your terms acceptance. Please try again.');
      });
    }
    return () => { active = false; };
  }, [userId, retry]);

  const accept = async () => {
    if (!userId || !agreed || saving) return;
    setSaving(true); setError(null);
    try {
      const { error } = await supabase.rpc('accept_current_terms', { accepted_version: TERMS_VERSION });
      if (error) throw error;
      setResult({ userId, accepted: true });
    } catch { setError('Could not save your acceptance. Please try again.'); }
    finally { setSaving(false); }
  };

  if (!userId || pathname === '/reset-password' || (result?.userId === userId && result.accepted)) return children;
  const loaded = result?.userId === userId;
  return (
    <SafeAreaScreen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Terms of Use</Text>
        <Text style={styles.meta}>Varta · {TERMS_VERSION}</Text>
        {!loaded ? <ActivityIndicator color={colors.textSecondary} /> : TERMS_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.heading}>{section.title}</Text>
            <Text style={styles.body}>{section.text}</Text>
          </View>
        ))}
        <PolicyLinks />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {!loaded && error ? <PrimaryButton label="Try again" onPress={() => setRetry((n) => n + 1)} /> : null}
        {loaded ? <>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: agreed }} onPress={() => setAgreed(!agreed)} disabled={saving} style={styles.checkbox}>
            <SymbolView name={{ ios: agreed ? 'checkmark.square.fill' : 'square', android: agreed ? 'check_box' : 'check_box_outline_blank', web: agreed ? 'check_box' : 'check_box_outline_blank' }} size={24} tintColor={colors.textPrimary} />
            <Text style={styles.agreement}>I agree to the Terms of Use and acknowledge the Privacy Policy.</Text>
          </Pressable>
          <PrimaryButton label="Accept and continue" disabled={!agreed} isLoading={saving} onPress={() => void accept()} />
        </> : null}
        <Pressable accessibilityRole="button" disabled={saving} style={styles.signOut} onPress={() => {
          void supabase.auth.signOut().then(({ error }) => {
            if (error) setError('Could not sign out. Please try again.');
          }).catch(() => {
            setError('Could not sign out. Please try again.');
          });
        }}><Text style={styles.body}>Sign out</Text></Pressable>
      </ScrollView>
    </SafeAreaScreen>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md, maxWidth: 720, width: '100%', alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textSecondary },
  section: { gap: spacing.xs },
  heading: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  body: { fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  checkbox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  agreement: { flex: 1, fontSize: 14, lineHeight: 21, color: colors.textPrimary },
  error: { fontSize: 14, color: colors.danger },
  signOut: { alignItems: 'center', padding: spacing.md },
});
