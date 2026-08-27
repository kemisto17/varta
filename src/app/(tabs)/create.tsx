import type { ImagePickerAsset } from 'expo-image-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import {
  radius,
  spacing,
  type ThemeColors,
} from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useFeed } from '../../hooks/useFeed';
import { useProfile } from '../../hooks/useProfile';
import { useThemedStyles } from '../../hooks/useTheme';
import { requestImageLibraryAccess } from '../../lib/imagePicker';
import { getManageableOrganizationsForPosting } from '../../lib/organizations';
import {
  getPostById,
  getPostErrorMessage,
  MAX_POST_CHARACTERS,
  MAX_POST_IMAGE_SIZE,
  publishPost,
} from '../../lib/posts';
import { getInitials } from '../../lib/text';
import type { ManageableOrganization } from '../../types/organization';

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
    isPicking,
    setIsPicking,
  ] =
    useState(false);

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

  const selectedOrganization =
    manageableOrganizations.find(
      (organization) =>
        organization.id ===
        selectedOrganizationId
    ) ?? null;

  useEffect(() => {
    const userId =
      session?.user.id;

    let isActive = true;

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
          if (isActive) {
            setManageableOrganizations(
              organizations
            );
          }
        }
      )
      .catch(
        (
          error: unknown
        ) => {
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
    content.trim().length >
      0 ||
    imageAsset !== null;

  const canPublish =
    hasPostContent &&
    !isPublishing;

  const pickImage =
    async () => {
      if (
        isPicking ||
        isPublishing
      ) {
        return;
      }

      setIsPicking(true);
      setErrorMessage(null);

      try {
        if (
          !(await requestImageLibraryAccess())
        ) {
          setErrorMessage(
            'Allow photo access to add an image to your post.'
          );

          return;
        }

        const result =
          await ImagePicker.launchImageLibraryAsync(
            {
              allowsEditing:
                false,
              allowsMultipleSelection:
                false,
              mediaTypes: [
                'images',
              ],
              quality:
                0.78,
            }
          );

        if (
          result.canceled ||
          result.assets
            .length === 0
        ) {
          return;
        }

        const nextAsset =
          result.assets[0];

        if (
          nextAsset.fileSize &&
          nextAsset.fileSize >
            MAX_POST_IMAGE_SIZE
        ) {
          setErrorMessage(
            'Choose an image smaller than 8 MB.'
          );

          return;
        }

        setImageAsset(
          nextAsset
        );
      } catch {
        setErrorMessage(
          'We could not open your photo library. Please try again.'
        );
      } finally {
        setIsPicking(
          false
        );
      }
    };

  const handlePublish =
    async () => {
      const userId =
        session?.user.id;

      if (
        !canPublish ||
        !userId
      ) {
        return;
      }

      setIsPublishing(
        true
      );

      setErrorMessage(
        null
      );

      try {
        /*
         * First perform the actual
         * mutation.
         *
         * Once this succeeds, the
         * post exists in the DB.
         */
        const published =
          await publishPost({
            asset:
              imageAsset,
            content,
            organizationId:
              selectedOrganizationId,
            userId,
          });

        /*
         * Hydrate only the newly
         * created post instead of
         * downloading page 1 of the
         * feed again.
         *
         * A failure here must NOT be
         * reported as "Publish
         * failed", because the DB
         * mutation already succeeded.
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

          /*
           * Best-effort silent
           * recovery. Do not block
           * navigation or tell the
           * user that publishing
           * failed.
           */
          void refreshFeed(
            false
          );
        }

        setContent('');
        setImageAsset(
          null
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
                size={42}
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
                size={17}
                tintColor={
                  colors.textSecondary
                }
              />
            ) : null}
          </Pressable>

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
            placeholder="What's happening on campus?"
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

          {imageAsset ? (
            <View
              style={
                styles.imageContainer
              }
            >
              <Image
                accessibilityLabel="Selected post photo"
                resizeMode="cover"
                source={{
                  uri:
                    imageAsset.uri,
                }}
                style={
                  styles.imagePreview
                }
              />

              <Pressable
                accessibilityLabel="Remove selected photo"
                accessibilityRole="button"
                disabled={
                  isPublishing
                }
                onPress={() =>
                  setImageAsset(
                    null
                  )
                }
                style={({
                  pressed,
                }) => [
                  styles.removeImageButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <SymbolView
                  name={{
                    android:
                      'close',
                    ios:
                      'xmark',
                    web:
                      'close',
                  }}
                  size={18}
                  tintColor={
                    colors.viewerForeground
                  }
                />
              </Pressable>
            </View>
          ) : null}

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

          <View
            style={
              styles.footer
            }
          >
            <Pressable
              accessibilityRole="button"
              disabled={
                isPicking ||
                isPublishing
              }
              onPress={() =>
                void pickImage()
              }
              style={({
                pressed,
              }) => [
                styles.mediaButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              {isPicking ? (
                <ActivityIndicator
                  color={
                    colors.textPrimary
                  }
                  size="small"
                />
              ) : (
                <SymbolView
                  name={{
                    android:
                      'image',
                    ios:
                      'photo',
                    web:
                      'image',
                  }}
                  size={21}
                  tintColor={
                    colors.textPrimary
                  }
                />
              )}

              <Text
                style={
                  styles.mediaButtonText
                }
              >
                {imageAsset
                  ? 'Change photo'
                  : 'Add photo'}
              </Text>
            </Pressable>
          </View>

          <Text
            style={
              styles.mediaHint
            }
          >
            JPG, PNG, WebP,
            HEIC, or HEIF · up
            to 8 MB
          </Text>
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
      paddingBottom: 160,
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
      fontWeight: '700',
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

    publishButtonDisabled:
      {
        backgroundColor:
          colors.border,
      },

    publishText: {
      fontSize: 14,
      fontWeight: '600',
      color:
        colors.white,
    },

    publishTextDisabled:
      {
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
      fontWeight: '700',
    },

    authorCopy: {
      flex: 1,
      marginLeft:
        spacing.md,
    },

    authorName: {
      fontSize: 14,
      fontWeight: '600',
      color:
        colors.textPrimary,
    },

    authorMeta: {
      marginTop: 3,
      fontSize: 12,
      color:
        colors.textSecondary,
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
      aspectRatio: 4 / 3,
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
      fontWeight: '500',
      color:
        colors.textPrimary,
    },

    characterCount: {
      fontSize: 12,
      color:
        colors.textMuted,
    },

    characterCountWarning:
      {
        color:
          colors.textSecondary,
        fontWeight:
          '600',
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