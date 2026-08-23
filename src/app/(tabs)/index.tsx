import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PostCard } from '../../components/PostCard';
import { mockPosts } from '../../constants/mockPosts';
import { colors, spacing } from '../../constants/theme';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={mockPosts}
        keyExtractor={(post) => post.id}
        renderItem={({ item }) => <PostCard post={item} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View>
                <Text style={styles.brand}>Campus</Text>
                <Text style={styles.greeting}>Good evening.</Text>
              </View>

              <View style={styles.avatar}>
                <Text style={styles.avatarText}>P</Text>
              </View>
            </View>

            <View style={styles.intro}>
              <Text style={styles.heading}>What's happening?</Text>

              <Text style={styles.subheading}>
                Discussions, updates and everything happening around campus.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>CAMPUS NOW</Text>

              <View style={styles.highlight}>
                <Text style={styles.highlightMeta}>TRENDING</Text>

                <Text style={styles.highlightTitle}>
                  Placement drive registrations close tomorrow
                </Text>

                <Text style={styles.highlightFooter}>
                  142 students discussing
                </Text>
              </View>
            </View>

            <View style={styles.feedHeader}>
              <Text style={styles.sectionTitle}>Latest</Text>
              <Text style={styles.sectionAction}>See all</Text>
            </View>
          </>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  header: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  brand: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  greeting: {
    marginTop: 2,
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },

  intro: {
    marginTop: spacing.xxl,
  },

  heading: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  subheading: {
    marginTop: spacing.sm,
    maxWidth: 320,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },

  section: {
    marginTop: spacing.xxl,
  },

  sectionLabel: {
    marginBottom: spacing.md,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: colors.textMuted,
  },

  highlight: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
  },

  highlightMeta: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textSecondary,
  },

  highlightTitle: {
    marginTop: spacing.sm,
    maxWidth: 320,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  highlightFooter: {
    marginTop: spacing.md,
    fontSize: 13,
    color: colors.textSecondary,
  },

  feedHeader: {
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  sectionAction: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
});