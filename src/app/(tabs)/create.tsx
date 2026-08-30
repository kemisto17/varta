import type { ImagePickerAsset } from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { SafeAreaScreen } from '../../components/SafeAreaScreen';
import { ActionSheet } from '../../components/moderation/ActionSheet';
import { OrganizationAvatar } from '../../components/organizations/OrganizationAvatar';
import { PostImageField } from '../../components/posts/PostImageField';
import {
  radius,
  spacing,
  type ThemeColors,
} from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useFeed } from '../../hooks/useFeed';
import { useProfile } from '../../hooks/useProfile';
import { useThemedStyles } from '../../hooks/useTheme';
import { getManageableOrganizationsForPosting } from '../../lib/organizations';
import {
  getPostById,
  getPostErrorMessage,
  MAX_LOST_FOUND_LOCATION_CHARACTERS,
  MAX_POST_CHARACTERS,
  publishPost,
} from '../../lib/posts';
import { getInitials } from '../../lib/text';
import type { ManageableOrganization } from '../../types/organization';
import type { PostKind } from '../../types/post';

export default function CreateScreen() {
  const { colors, styles } =
    useThemedStyles(createStyles);

  const router = useRouter();

  const { session } = useAuth();

  const {
    prependPost,
    refreshFeed,
  } = useFeed();

  const { profile } =
    useProfile();

  /*
   * Synchronous lock for the actual
   * publish mutation.
   *
   * React state alone cannot stop two
   * taps that happen before the next
   * render.
   */
  const isPublishRequestPending =
    useRef(false);

  const [
    content,
    setContent,
  ] = useState('');

  const [
    imageAsset,
    setImageAsset,
  ] =
    useState<ImagePickerAsset | null>(
      null
    );

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<string | null>(
      null
    );

  const [
    postKind,
    setPostKind,
  ] = useState<PostKind>(
    'general'
  );

  const [
    lostFoundLocation,
    setLostFoundLocation,
  ] = useState('');

  const [
    isPublishing,
    setIsPublishing,
  ] =
    useState(false);

  const [
    isIdentityPickerVisible,
    setIsIdentityPickerVisible,
  ] =
    useState(false);

  const [
    manageableOrganizations,
    setManageableOrganizations,
  ] = useState<
    ManageableOrganization[]
  >([]);

  const [
    selectedOrganizationId,
    setSelectedOrganizationId,
  ] =
    useState<
      string | null
    >(null);

  /*
   * Resolve the selected ID against the
   * current authoritative list.
   *
   * Never publish using a raw/stale ID
   * that is no longer represented by an
   * organization this user can manage.
   */
  const selectedOrganization =
    manageableOrganizations.find(
      (organization) =>
        organization.id ===
        selectedOrganizationId
    ) ?? null;

  const effectiveOrganizationId =
    selectedOrganization?.id ??
    null;

  useEffect(() => {
    const userId =
      session?.user.id;

    let isActive = true;

    /*
     * Organization identities belong to
     * the current account.
     *
     * Clear them immediately whenever
     * the authenticated user changes.
     */
    setManageableOrganizations(
      []
    );

    setSelectedOrganizationId(
      null
    );

    setIsIdentityPickerVisible(
      false
    );

    if (!userId) {
      return () => {
        isActive = false;
      };
    }

    void getManageableOrganizationsForPosting(
      userId
    )
      .then(
        (
          organizations
        ) => {
          if (!isActive) {
            return;
          }

          setManageableOrganizations(
            organizations
          );
        }
      )
      .catch(
        (
          error: unknown
        ) => {
          if (!isActive) {
            return;
          }

          console.warn(
            '[create-post] Could not load organization identities.',
            error
          );
        }
      );

    return () => {
      isActive = false;
    };
  }, [session?.user.id]);

  const remainingCharacters =
    MAX_POST_CHARACTERS -
    content.length;

  const hasPostContent =
    postKind === 'general'
      ? content.trim().length >
          0 ||
        imageAsset !== null
      : content.trim().length >
        0;

  const canPublish =
    hasPostContent &&
    !isPublishing;

  const handlePublish =
    async () => {
      const userId =
        session?.user.id;

      if (
        isPublishRequestPending.current ||
        !hasPostContent ||
        !userId
      ) {
        return;
      }

      isPublishRequestPending.current =
        true;

      setIsPublishing(
        true
      );

      setErrorMessage(
        null
      );

      try {
        /*
         * effectiveOrganizationId can
         * only contain an organization
         * that still exists in the
         * current manageable identities
         * list.
         */
        const published =
          await publishPost({
            asset:
              imageAsset,

            content,

            lostFoundLocation,

            organizationId:
              effectiveOrganizationId,

            postKind,

            userId,
          });

        /*
         * Hydrate only the new post.
         *
         * The DB mutation has already
         * succeeded at this point, so a
         * feed-sync failure must not be
         * presented as a publish failure.
         */
        try {
          const newPost =
            await getPostById(
              published.id,
              userId
            );

          if (newPost) {
            prependPost(
              newPost
            );
          } else {
            await refreshFeed(
              false
            );
          }
        } catch (
          feedSyncError
        ) {
          console.warn(
            '[create-post] Post published, but local feed sync failed.',
            feedSyncError
          );

          void refreshFeed(
            false
          );
        }

        setContent(
          ''
        );

        setImageAsset(
          null
        );

        setLostFoundLocation(
          ''
        );

        setPostKind(
          'general'
        );

        router.navigate(
          '/'
        );
      } catch (error) {
        console.warn(
          '[create-post] Publish failed.',
          error
        );

        setErrorMessage(
          getPostErrorMessage(
            error
          )
        );
      } finally {
        isPublishRequestPending.current =
          false;

        setIsPublishing(
          false
        );
      }
    };

  return (
    <SafeAreaScreen
      style={
        styles.screen
      }
      withinTabNavigator
    >
      <KeyboardAvoidingView
        behavior={
          Platform.OS ===
          'ios'
            ? 'padding'
            : 'height'
        }
        keyboardVerticalOffset={
          0
        }
        style={
          styles.keyboardView
        }
      >
        <ScrollView
          contentContainerStyle={
            styles.content
          }
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={
            false
          }
        >
          <View
            style={
              styles.header
            }
          >
            <Text
              style={
                styles.title
              }
            >
              New post
            </Text>

            <Pressable
              accessibilityRole="button"
              disabled={
                !canPublish
              }
              onPress={() =>
                void handlePublish()
              }
              style={({
                pressed,
              }) => [
                styles.publishButton,

                !canPublish &&
                  styles.publishButtonDisabled,

                pressed &&
                  canPublish &&
                  styles.pressed,
              ]}
            >
              {isPublishing ? (
                <ActivityIndicator
                  color={
                    colors.white
                  }
                  size="small"
                />
              ) : (
                <Text
                  style={[
                    styles.publishText,

                    !canPublish &&
                      styles.publishTextDisabled,
                  ]}
                >
                  Publish
                </Text>
              )}
            </Pressable>
          </View>

          <Pressable
            accessibilityRole={
              manageableOrganizations.length >
              0
                ? 'button'
                : undefined
            }
            disabled={
              manageableOrganizations.length ===
                0 ||
              isPublishing
            }
            onPress={() =>
              setIsIdentityPickerVisible(
                true
              )
            }
            style={({
              pressed,
            }) => [
              styles.authorRow,

              pressed &&
                styles.pressed,
            ]}
          >
            {selectedOrganization ? (
              <OrganizationAvatar
                name={
                  selectedOrganization.name
                }
                size={
                  42
                }
                uri={
                  selectedOrganization.avatarUrl
                }
              />
            ) : (
              <View
                style={
                  styles.avatar
                }
              >
                <Text
                  style={
                    styles.avatarText
                  }
                >
                  {getInitials(
                    profile?.full_name ??
                      'Student'
                  )}
                </Text>
              </View>
            )}

            <View
              style={
                styles.authorCopy
              }
            >
              <Text
                numberOfLines={
                  1
                }
                style={
                  styles.authorName
                }
              >
                {selectedOrganization?.name ??
                  profile?.full_name ??
                  'Student'}
              </Text>

              <Text
                numberOfLines={
                  1
                }
                style={
                  styles.authorMeta
                }
              >
                {selectedOrganization
                  ? `Official organization · ${selectedOrganization.campusShortName}`
                  : profile
                    ? `${profile.branch} · ${formatYear(
                        profile.year
                      )}`
                    : 'Campus member'}
              </Text>
            </View>

            {manageableOrganizations.length >
            0 ? (
              <SymbolView
                name={{
                  android:
                    'expand_more',

                  ios:
                    'chevron.down',

                  web:
                    'expand_more',
                }}
                size={
                  17
                }
                tintColor={
                  colors.textSecondary
                }
              />
            ) : null}
          </Pressable>

          <View
            style={
              styles.postKindPicker
            }
          >
            {(
              [
                ['general', 'Regular'],
                ['lost', 'Lost'],
                ['found', 'Found'],
              ] as const
            ).map(
              ([value, label]) => {
                const isSelected =
                  postKind === value;

                return (
                  <Pressable
                    accessibilityRole="button"
                    disabled={
                      isPublishing
                    }
                    key={
                      value
                    }
                    onPress={() =>
                      setPostKind(
                        value
                      )
                    }
                    style={(event) => [
                      styles.postKindButton,
                      isSelected &&
                        styles.postKindButtonSelected,
                      event.pressed &&
                        styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.postKindText,
                        isSelected &&
                          styles.postKindTextSelected,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              }
            )}
          </View>

          <TextInput
            editable={
              !isPublishing
            }
            maxLength={
              MAX_POST_CHARACTERS
            }
            multiline
            onChangeText={
              setContent
            }
            placeholder={
              postKind === 'lost'
                ? 'What did you lose? Add identifying details without sharing private information.'
                : postKind === 'found'
                  ? 'What did you find? Avoid details only the owner would know.'
                  : "What's happening on campus?"
            }
            placeholderTextColor={
              colors.textMuted
            }
            style={
              styles.input
            }
            textAlignVertical="top"
            value={
              content
            }
          />

          <View
            style={
              styles.characterRow
            }
          >
            <Text
              style={[
                styles.characterCount,

                remainingCharacters <
                  50 &&
                  styles.characterCountWarning,
              ]}
            >
              {
                content.length
              }
              /
              {
                MAX_POST_CHARACTERS
              }
            </Text>
          </View>

          {postKind !==
          'general' ? (
            <View
              style={
                styles.locationField
              }
            >
              <Text
                style={
                  styles.locationLabel
                }
              >
                Campus location
                (optional)
              </Text>

              <TextInput
                editable={
                  !isPublishing
                }
                maxLength={
                  MAX_LOST_FOUND_LOCATION_CHARACTERS
                }
                onChangeText={
                  setLostFoundLocation
                }
                placeholder="e.g. Main library, second floor"
                placeholderTextColor={
                  colors.textMuted
                }
                style={
                  styles.locationInput
                }
                value={
                  lostFoundLocation
                }
              />
            </View>
          ) : null}

          <PostImageField
            asset={
              imageAsset
            }
            disabled={
              isPublishing
            }
            existingImageUrl={
              null
            }
            onChange={
              setImageAsset
            }
            onError={
              setErrorMessage
            }
          />

          {errorMessage ? (
            <Text
              accessibilityRole="alert"
              style={
                styles.errorText
              }
            >
              {
                errorMessage
              }
            </Text>
          ) : null}

        </ScrollView>
      </KeyboardAvoidingView>

      <ActionSheet
        actions={[
          {
            label:
              profile?.full_name ??
              'My student profile',

            onPress: () =>
              setSelectedOrganizationId(
                null
              ),
          },

          ...manageableOrganizations.map(
            (
              organization
            ) => ({
              label:
                organization.name,

              onPress: () =>
                setSelectedOrganizationId(
                  organization.id
                ),
            })
          ),
        ]}
        message="Choose who this post is published as."
        onClose={() =>
          setIsIdentityPickerVisible(
            false
          )
        }
        title="Post as"
        visible={
          isIdentityPickerVisible
        }
      />
    </SafeAreaScreen>
  );
}

function formatYear(
  year: number
) {
  const suffix =
    year === 1
      ? 'st'
      : year === 2
        ? 'nd'
        : year === 3
          ? 'rd'
          : 'th';

  return `${year}${suffix} year`;
}

const createStyles = (
  colors: ThemeColors
) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor:
        colors.background,
    },

    keyboardView: {
      flex: 1,
    },

    content: {
      flexGrow: 1,
      paddingHorizontal:
        spacing.lg,
      paddingTop:
        spacing.lg,
      paddingBottom:
        160,
    },

    header: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
    },

    title: {
      fontSize: 26,
      fontWeight:
        '700',
      color:
        colors.textPrimary,
    },

    publishButton: {
      minWidth: 88,
      minHeight: 40,
      paddingHorizontal:
        18,
      borderRadius:
        radius.full,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.textPrimary,
    },

    publishButtonDisabled: {
      backgroundColor:
        colors.border,
    },

    publishText: {
      fontSize: 14,
      fontWeight:
        '600',
      color:
        colors.white,
    },

    publishTextDisabled: {
      color:
        colors.textMuted,
    },

    authorRow: {
      marginTop:
        spacing.xxl,
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor:
        colors.textPrimary,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    avatarText: {
      color:
        colors.white,
      fontSize: 13,
      fontWeight:
        '700',
    },

    authorCopy: {
      flex: 1,
      marginLeft:
        spacing.md,
    },

    authorName: {
      fontSize: 14,
      fontWeight:
        '600',
      color:
        colors.textPrimary,
    },

    authorMeta: {
      marginTop: 3,
      fontSize: 12,
      color:
        colors.textSecondary,
    },

    postKindPicker: {
      marginTop:
        spacing.xl,
      padding: 4,
      flexDirection:
        'row',
      gap: 4,
      borderRadius:
        radius.full,
      backgroundColor:
        colors.borderSubtle,
    },

    postKindButton: {
      minHeight: 38,
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderRadius:
        radius.full,
    },

    postKindButtonSelected: {
      backgroundColor:
        colors.surfaceElevated,
    },

    postKindText: {
      fontSize: 13,
      fontWeight:
        '600',
      color:
        colors.textSecondary,
    },

    postKindTextSelected: {
      color:
        colors.textPrimary,
    },

    input: {
      minHeight: 180,
      maxHeight: 260,
      marginTop:
        spacing.lg,
      padding: 0,
      fontSize: 18,
      lineHeight: 27,
      color:
        colors.textPrimary,
    },

    characterRow: {
      marginTop:
        spacing.sm,
      alignItems:
        'flex-end',
    },

    imageContainer: {
      position:
        'relative',
      width: '100%',
      marginTop:
        spacing.lg,
      aspectRatio:
        4 / 3,
    },

    imagePreview: {
      width: '100%',
      height: '100%',
      borderRadius:
        radius.lg,
      backgroundColor:
        colors.borderSubtle,
    },

    removeImageButton: {
      position:
        'absolute',
      top: 12,
      right: 12,
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor:
        colors.imageOverlay,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    errorText: {
      marginTop:
        spacing.md,
      fontSize: 13,
      lineHeight: 19,
      color:
        colors.danger,
    },

    footer: {
      marginTop:
        spacing.md,
      paddingTop:
        spacing.md,
      borderTopWidth: 1,
      borderTopColor:
        colors.borderSubtle,
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    mediaButton: {
      minHeight: 44,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        spacing.sm,
    },

    mediaButtonText: {
      fontSize: 14,
      fontWeight:
        '500',
      color:
        colors.textPrimary,
    },

    characterCount: {
      fontSize: 12,
      color:
        colors.textMuted,
    },

    characterCountWarning: {
      color:
        colors.textSecondary,
      fontWeight:
        '600',
    },

    locationField: {
      marginTop:
        spacing.md,
    },

    locationLabel: {
      marginBottom:
        spacing.sm,
      fontSize: 12,
      fontWeight:
        '600',
      color:
        colors.textSecondary,
    },

    locationInput: {
      minHeight: 46,
      paddingHorizontal:
        spacing.md,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius:
        radius.md,
      fontSize: 14,
      color:
        colors.textPrimary,
    },

    mediaHint: {
      marginTop:
        spacing.xs,
      fontSize: 11,
      color:
        colors.textMuted,
    },

    pressed: {
      opacity: 0.55,
    },
  });
