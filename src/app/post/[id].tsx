import { useThemedStyles } from '../../hooks/useTheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View, } from 'react-native';

import { Avatar } from '../../components/Avatar';
import { SafeAreaScreen } from '../../components/SafeAreaScreen';
import { PostCard } from '../../components/PostCard';
import { ActionSheet } from '../../components/moderation/ActionSheet';
import { BlockUserSheet } from '../../components/moderation/BlockUserSheet';
import { ReportSheet } from '../../components/moderation/ReportSheet';
import { radius, spacing, type ThemeColors } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import type { ModerationUser, ReportTarget } from '../../lib/moderation';
import {
  deletePost,
  getPostById,
  getPostErrorMessage,
} from '../../lib/posts';
import {
  createPostComment,
  deletePostComment,
  type CommentCursor,
  getInteractionErrorMessage,
  getPostCommentsPage,
  MAX_COMMENT_CHARACTERS,
  setPostLike,
} from '../../lib/postInteractions';
import { formatRelativeTimestamp } from '../../lib/time';
import type { FeedPost, PostComment } from '../../types/post';

type DetailStatus = 'loading' | 'ready' | 'unavailable' | 'error';

export default function PostDetailScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const postId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const commentInputRef = useRef<TextInput>(null);
  const detailRequestId = useRef(0);
  const isLikeRequestPending = useRef(false);
  const isCommentRequestPending = useRef(false);
  const isLoadingMoreCommentsRef = useRef(false);
  const commentDeleteRequests = useRef(new Set<string>());
  const [blockTarget, setBlockTarget] = useState<ModerationUser | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentCursor, setCommentCursor] = useState<CommentCursor | null>(null);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [deletingCommentIds, setDeletingCommentIds] = useState<Set<string>>(
    () => new Set()
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isLoadingMoreComments, setIsLoadingMoreComments] = useState(false);
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [post, setPost] = useState<FeedPost | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [status, setStatus] = useState<DetailStatus>('loading');

  const loadDetail = useCallback(async () => {
    if (!postId || !userId) {
      setStatus('unavailable');
      return;
    }

    const activeRequestId = detailRequestId.current + 1;
    detailRequestId.current = activeRequestId;
    setStatus('loading');
    setErrorMessage(null);

    try {
      const [nextPost, commentPage] = await Promise.all([
        getPostById(postId, userId),
        getPostCommentsPage(postId),
      ]);

      if (detailRequestId.current !== activeRequestId) {
        return;
      }

      if (!nextPost) {
        setPost(null);
        setComments([]);
        setCommentCursor(null);
        setHasMoreComments(false);
        setStatus('unavailable');
        return;
      }

      setPost(nextPost);
      setComments(commentPage.comments);
      setCommentCursor(commentPage.cursor);
      setHasMoreComments(commentPage.hasMore);
      setStatus('ready');
    } catch (error) {
      if (detailRequestId.current !== activeRequestId) {
        return;
      }

      console.warn('[post-detail] Could not load post.', error);
      setErrorMessage('We could not load this post. Check your connection and try again.');
      setStatus('error');
    }
  }, [postId, userId]);

  useEffect(() => {
    void loadDetail();

    return () => {
      detailRequestId.current += 1;
    };
  }, [loadDetail]);

  const loadMoreComments = useCallback(async () => {
    if (
      !postId ||
      !commentCursor ||
      !hasMoreComments ||
      isLoadingMoreCommentsRef.current
    ) {
      return;
    }

    isLoadingMoreCommentsRef.current = true;
    setIsLoadingMoreComments(true);

    try {
      const page = await getPostCommentsPage(postId, commentCursor);

      setComments((current) => {
        const existingIds = new Set(current.map((comment) => comment.id));

        return [
          ...current,
          ...page.comments.filter((comment) => !existingIds.has(comment.id)),
        ];
      });
      setCommentCursor(page.cursor);
      setHasMoreComments(page.hasMore);
    } catch (error) {
      console.warn('[post-detail] Could not load more comments.', error);
      setErrorMessage('More comments could not be loaded. Try again.');
    } finally {
      isLoadingMoreCommentsRef.current = false;
      setIsLoadingMoreComments(false);
    }
  }, [commentCursor, hasMoreComments, postId]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  }, [router]);

  const openAuthor = useCallback(
    (authorId: string) => {
      if (authorId === userId) {
        router.navigate('/(tabs)/profile');
        return;
      }

      router.push({ pathname: '/user/[id]', params: { id: authorId } });
    },
    [router, userId]
  );

  const handleToggleLike = useCallback(
    async (currentPost: FeedPost) => {
      if (!userId || isLikeRequestPending.current) {
        return;
      }

      const previousState = {
        isLikedByCurrentUser: currentPost.isLikedByCurrentUser,
        likeCount: currentPost.likeCount,
      };
      const nextIsLiked = !currentPost.isLikedByCurrentUser;

      isLikeRequestPending.current = true;
      setIsLiking(true);
      setErrorMessage(null);
      setPost((current) =>
        current
          ? {
              ...current,
              isLikedByCurrentUser: nextIsLiked,
              likeCount: Math.max(
                0,
                currentPost.likeCount + (nextIsLiked ? 1 : -1)
              ),
            }
          : current
      );

      try {
        await setPostLike({
          isLiked: nextIsLiked,
          postId: currentPost.id,
          userId,
        });
      } catch (error) {
        console.warn('[post-detail] Could not update like.', error);
        setPost((current) =>
          current ? { ...current, ...previousState } : current
        );
        setErrorMessage(getInteractionErrorMessage(error));
      } finally {
        isLikeRequestPending.current = false;
        setIsLiking(false);
      }
    },
    [userId]
  );

  const handleCreateComment = useCallback(async () => {
    if (
      !postId ||
      !userId ||
      !commentText.trim() ||
      isCommentRequestPending.current
    ) {
      return;
    }

    isCommentRequestPending.current = true;
    setIsSendingComment(true);
    setErrorMessage(null);

    try {
      const comment = await createPostComment({
        content: commentText,
        postId,
        userId,
      });

      setComments((current) => [...current, comment]);
      setPost((current) =>
        current
          ? { ...current, commentCount: current.commentCount + 1 }
          : current
      );
      setCommentText('');
    } catch (error) {
      console.warn('[post-detail] Could not create comment.', error);
      setErrorMessage(getInteractionErrorMessage(error));
    } finally {
      isCommentRequestPending.current = false;
      setIsSendingComment(false);
    }
  }, [commentText, postId, userId]);

  const handleDeleteComment = useCallback(
    async (comment: PostComment) => {
      if (
        !userId ||
        comment.authorId !== userId ||
        commentDeleteRequests.current.has(comment.id)
      ) {
        return;
      }

      commentDeleteRequests.current.add(comment.id);
      setDeletingCommentIds((current) => new Set(current).add(comment.id));
      setErrorMessage(null);

      try {
        await deletePostComment(comment.id, userId);
        setComments((current) =>
          current.filter((item) => item.id !== comment.id)
        );
        setPost((current) =>
          current
            ? {
                ...current,
                commentCount: Math.max(0, current.commentCount - 1),
              }
            : current
        );
      } catch (error) {
        console.warn('[post-detail] Could not delete comment.', error);
        setErrorMessage(getInteractionErrorMessage(error));
      } finally {
        commentDeleteRequests.current.delete(comment.id);
        setDeletingCommentIds((current) => {
          const next = new Set(current);
          next.delete(comment.id);
          return next;
        });
      }
    },
    [userId]
  );

  const handleDeletePost = useCallback(
    async (currentPost: FeedPost) => {
      if (!userId || isDeletingPost) {
        return;
      }

      setIsDeletingPost(true);
      setErrorMessage(null);

      try {
        const result = await deletePost(currentPost, userId);

        if (result.mediaCleanupFailed) {
          Alert.alert(
            'Post deleted',
            'The post is gone, but its photo could not be cleaned up automatically.'
          );
        }

        goBack();
      } catch (error) {
        console.warn('[post-detail] Could not delete post.', error);
        setErrorMessage(getPostErrorMessage(error));
        setIsDeletingPost(false);
      }
    },
    [goBack, isDeletingPost, userId]
  );

  const canSendComment = commentText.trim().length > 0 && !isSendingComment;

  return (
    <SafeAreaScreen style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={12}
          onPress={goBack}
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.pressed,
          ]}
        >
          <SymbolView
            name={{ android: 'arrow_back', ios: 'chevron.left', web: 'arrow_back' }}
            size={22}
            tintColor={colors.textPrimary}
          />
        </Pressable>
        <Text style={styles.headerTitle}>Post</Text>
        <View style={styles.headerButton} />
      </View>

      {status === 'loading' ? (
        <DetailSkeleton />
      ) : status === 'unavailable' ? (
        <DetailState
          actionLabel="Back to feed"
          message="It may have been deleted, or it is not available to your university."
          onAction={goBack}
          title="Post unavailable"
        />
      ) : status === 'error' || !post ? (
        <DetailState
          actionLabel="Try again"
          message={errorMessage ?? 'We could not load this post.'}
          onAction={() => void loadDetail()}
          title="Could not load post"
        />
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <FlatList
            contentContainerStyle={styles.listContent}
            data={comments}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(comment) => comment.id}
            ListEmptyComponent={
              <View style={styles.emptyComments}>
                <Text style={styles.emptyTitle}>No comments yet.</Text>
                <Text style={styles.emptyMessage}>Start the conversation.</Text>
              </View>
            }
            ListHeaderComponent={
              <>
                <PostCard
                  currentUserId={userId}
                  isDeleting={isDeletingPost}
                  isLikePending={isLiking}
                  onAuthorPress={(currentPost) => openAuthor(currentPost.authorId)}
                  onBlockUser={(currentPost) =>
                    setBlockTarget({
                      fullName: currentPost.author.fullName,
                      id: currentPost.authorId,
                    })
                  }
                  onCommentPress={() => commentInputRef.current?.focus()}
                  onDelete={handleDeletePost}
                  onReport={(currentPost) =>
                    setReportTarget({
                      id: currentPost.id,
                      label: 'Report this post',
                      type: 'post',
                    })
                  }
                  onToggleLike={handleToggleLike}
                  post={post}
                />

                <View style={styles.commentsHeading}>
                  <Text style={styles.commentsEyebrow}>CONVERSATION</Text>
                  <Text style={styles.commentsTitle}>
                    Comments · {post.commentCount}
                  </Text>
                </View>

                {errorMessage ? (
                  <Text accessibilityRole="alert" style={styles.inlineError}>
                    {errorMessage}
                  </Text>
                ) : null}
              </>
            }
            ListFooterComponent={
              isLoadingMoreComments ? (
                <ActivityIndicator
                  color={colors.textSecondary}
                  style={styles.footerLoader}
                />
              ) : null
            }
            onEndReached={() => void loadMoreComments()}
            onEndReachedThreshold={0.35}
            renderItem={({ item }) => (
              <CommentRow
                comment={item}
                currentUserId={userId}
                isDeleting={deletingCommentIds.has(item.id)}
                onAuthorPress={openAuthor}
                onDelete={handleDeleteComment}
                onReport={(comment) =>
                  setReportTarget({
                    id: comment.id,
                    label: 'Report this comment',
                    type: 'comment',
                  })
                }
              />
            )}
            showsVerticalScrollIndicator={false}
          />

          <View style={styles.composer}>
            <TextInput
              accessibilityLabel="Add a comment"
              editable={!isSendingComment}
              maxLength={MAX_COMMENT_CHARACTERS}
              multiline
              onChangeText={setCommentText}
              placeholder="Add a comment..."
              placeholderTextColor={colors.textMuted}
              ref={commentInputRef}
              style={styles.commentInput}
              value={commentText}
            />

            <Pressable
              accessibilityLabel="Send comment"
              accessibilityRole="button"
              disabled={!canSendComment}
              onPress={() => void handleCreateComment()}
              style={({ pressed }) => [
                styles.sendButton,
                !canSendComment && styles.sendButtonDisabled,
                pressed && canSendComment && styles.pressed,
              ]}
            >
              {isSendingComment ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <SymbolView
                  name={{ android: 'arrow_upward', ios: 'arrow.up', web: 'arrow_upward' }}
                  size={18}
                  tintColor={canSendComment ? colors.white : colors.textMuted}
                />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      <ReportSheet
        onClose={() => setReportTarget(null)}
        reporterId={userId}
        target={reportTarget}
      />

      <BlockUserSheet
        currentUserId={userId}
        onChanged={goBack}
        onClose={() => setBlockTarget(null)}
        user={blockTarget}
      />
    </SafeAreaScreen>
  );
}

function CommentRow({
  comment,
  currentUserId,
  isDeleting,
  onAuthorPress,
  onDelete,
  onReport,
}: {
  comment: PostComment;
  currentUserId: string | null;
  isDeleting: boolean;
  onAuthorPress: (authorId: string) => void;
  onDelete: (comment: PostComment) => void;
  onReport: (comment: PostComment) => void;
}) {
  const { colors, styles } = useThemedStyles(createStyles);
  const isOwnComment = comment.authorId === currentUserId;
  const [isOptionsVisible, setIsOptionsVisible] = useState(false);

  return (
    <View style={styles.commentRow}>
      <Pressable
        accessibilityLabel={`Open ${comment.author.fullName}'s profile`}
        accessibilityRole="button"
        onPress={() => onAuthorPress(comment.authorId)}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Avatar
          fullName={comment.author.fullName}
          size={36}
          uri={comment.author.avatarUrl}
          verified={comment.author.isVerified}
        />
      </Pressable>

      <View style={styles.commentBody}>
        <View style={styles.commentHeader}>
          <Pressable
            accessibilityLabel={`Open ${comment.author.fullName}'s profile`}
            accessibilityRole="button"
            onPress={() => onAuthorPress(comment.authorId)}
            style={({ pressed }) => [
              styles.commentIdentity,
              pressed && styles.pressed,
            ]}
          >
            <Text numberOfLines={1} style={styles.commentAuthor}>
              {comment.author.fullName}
            </Text>
            <Text numberOfLines={1} style={styles.commentMeta}>
              {comment.author.branch} · Year {comment.author.year} ·{' '}
              {formatRelativeTimestamp(comment.createdAt)}
            </Text>
          </Pressable>

          {currentUserId ? (
            <Pressable
              accessibilityLabel="Comment options"
              accessibilityRole="button"
              disabled={isDeleting}
              hitSlop={10}
              onPress={() => setIsOptionsVisible(true)}
              style={({ pressed }) => [
                styles.commentMenu,
                pressed && styles.pressed,
              ]}
            >
              {isDeleting ? (
                <ActivityIndicator color={colors.textSecondary} size="small" />
              ) : (
                <SymbolView
                  name={{ android: 'more_horiz', ios: 'ellipsis', web: 'more_horiz' }}
                  size={18}
                  tintColor={colors.textSecondary}
                />
              )}
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.commentContent}>{comment.content}</Text>
      </View>

      <ActionSheet
        actions={
          isOwnComment
            ? [
                {
                  label: 'Delete comment',
                  onPress: () => onDelete(comment),
                  tone: 'danger' as const,
                },
              ]
            : [
                {
                  label: 'Report comment',
                  onPress: () => onReport(comment),
                  tone: 'danger' as const,
                },
              ]
        }
        message={
          isOwnComment
            ? 'This removes your comment from the conversation. This cannot be undone.'
            : null
        }
        onClose={() => setIsOptionsVisible(false)}
        title={isOwnComment ? 'Delete this comment?' : 'Comment options'}
        visible={isOptionsVisible}
      />
    </View>
  );
}

function DetailSkeleton() {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View accessibilityLabel="Loading post and comments" style={styles.skeleton}>
      <View style={styles.skeletonHeader}>
        <View style={[styles.skeletonBlock, styles.skeletonAvatar]} />
        <View style={styles.skeletonIdentity}>
          <View style={[styles.skeletonBlock, styles.skeletonName]} />
          <View style={[styles.skeletonBlock, styles.skeletonMeta]} />
        </View>
      </View>
      <View style={[styles.skeletonBlock, styles.skeletonLine]} />
      <View style={[styles.skeletonBlock, styles.skeletonShortLine]} />
      <View style={styles.skeletonDivider} />
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.skeletonComment}>
          <View style={[styles.skeletonBlock, styles.skeletonCommentAvatar]} />
          <View style={styles.skeletonCommentCopy}>
            <View style={[styles.skeletonBlock, styles.skeletonCommentName]} />
            <View style={[styles.skeletonBlock, styles.skeletonCommentLine]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function DetailState({
  actionLabel,
  message,
  onAction,
  title,
}: {
  actionLabel: string;
  message: string;
  onAction: () => void;
  title: string;
}) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.state}>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onAction}
        style={({ pressed }) => [
          styles.stateButton,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.stateButtonText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    minHeight: 56,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  keyboardView: {
    flex: 1,
  },

  listContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },

  commentsHeading: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },

  commentsEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.25,
    color: colors.textMuted,
  },

  commentsTitle: {
    marginTop: spacing.xs,
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  inlineError: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    fontSize: 12,
    lineHeight: 18,
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
  },

  footerLoader: { marginVertical: spacing.lg },

  emptyComments: {
    minHeight: 160,
    paddingVertical: spacing.xl,
    justifyContent: 'center',
  },

  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  emptyMessage: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.textSecondary,
  },

  commentRow: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  commentBody: {
    flex: 1,
    marginLeft: spacing.md,
  },

  commentHeader: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  commentIdentity: {
    flex: 1,
  },

  commentAuthor: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  commentMeta: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textMuted,
  },

  commentMenu: {
    width: 34,
    height: 34,
    marginTop: -6,
    marginRight: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  commentContent: {
    marginTop: spacing.xs,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textPrimary,
  },

  composer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },

  commentInput: {
    flex: 1,
    maxHeight: 112,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },

  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textPrimary,
  },

  sendButtonDisabled: {
    backgroundColor: colors.border,
  },

  state: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },

  stateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  stateMessage: {
    maxWidth: 320,
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },

  stateButton: {
    minHeight: 44,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textPrimary,
  },

  stateButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },

  skeleton: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },

  skeletonBlock: {
    borderRadius: radius.sm,
    backgroundColor: colors.border,
  },

  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  skeletonAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },

  skeletonIdentity: {
    marginLeft: spacing.md,
    gap: spacing.sm,
  },

  skeletonName: {
    width: 132,
    height: 11,
  },

  skeletonMeta: {
    width: 190,
    height: 9,
  },

  skeletonLine: {
    width: '92%',
    height: 12,
    marginTop: spacing.lg,
  },

  skeletonShortLine: {
    width: '64%',
    height: 12,
    marginTop: spacing.sm,
  },

  skeletonDivider: {
    height: 1,
    marginTop: spacing.xl,
    backgroundColor: colors.borderSubtle,
  },

  skeletonComment: {
    paddingVertical: spacing.md,
    flexDirection: 'row',
  },

  skeletonCommentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },

  skeletonCommentCopy: {
    flex: 1,
    marginLeft: spacing.md,
  },

  skeletonCommentName: {
    width: 120,
    height: 10,
  },

  skeletonCommentLine: {
    width: '88%',
    height: 11,
    marginTop: spacing.md,
  },

  pressed: {
    opacity: 0.58,
  },
});
