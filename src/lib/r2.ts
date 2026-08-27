import * as FileSystem from 'expo-file-system/legacy';
import type { ImagePickerAsset } from 'expo-image-picker';

import { supabase } from './supabase';

type CreateUploadResponse = {
  contentType: string;
  objectKey: string;
  uploadUrl: string;
};

type DeleteMediaResponse = {
  deleted: boolean;
};

type MediaKind =
  | 'avatar'
  | 'event-image'
  | 'organization-avatar'
  | 'post';

function getAssetContentType(
  asset: ImagePickerAsset
) {
  if (asset.mimeType) {
    return asset.mimeType;
  }

  const uri =
    asset.uri.toLowerCase();

  if (
    uri.endsWith('.png')
  ) {
    return 'image/png';
  }

  if (
    uri.endsWith('.webp')
  ) {
    return 'image/webp';
  }

  if (
    uri.endsWith('.heic')
  ) {
    return 'image/heic';
  }

  if (
    uri.endsWith('.heif')
  ) {
    return 'image/heif';
  }

  return 'image/jpeg';
}

function base64ToArrayBuffer(
  base64: string
) {
  const binary =
    atob(base64);

  const bytes =
    new Uint8Array(
      binary.length
    );

  for (
    let index = 0;
    index <
    binary.length;
    index += 1
  ) {
    bytes[index] =
      binary.charCodeAt(
        index
      );
  }

  return bytes.buffer;
}

async function readAsset(
  asset: ImagePickerAsset
) {
  /*
   * Keep the legacy Expo file-system
   * implementation here.
   *
   * Direct fetch(file://...) is not
   * reliable for Expo local image
   * assets on Android.
   */
  const base64 =
    await FileSystem.readAsStringAsync(
      asset.uri,
      {
        encoding:
          FileSystem
            .EncodingType
            .Base64,
      }
    );

  if (!base64) {
    throw new Error(
      'Selected image could not be read.'
    );
  }

  return base64ToArrayBuffer(
    base64
  );
}

async function getAccessToken() {
  const {
    data: {
      session,
    },
    error,
  } =
    await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (
    !session?.access_token
  ) {
    throw new Error(
      'You must be signed in.'
    );
  }

  return session.access_token;
}

export async function uploadPostImageToR2({
  asset,
  organizationId,
}: {
  asset: ImagePickerAsset;
  organizationId?:
    string | null;
}) {
  return uploadImageToR2({
    asset,
    kind: 'post',
    organizationId,
  });
}

export async function uploadAvatarToR2(
  asset: ImagePickerAsset
) {
  return uploadImageToR2({
    asset,
    kind: 'avatar',
  });
}

export async function uploadOrganizationAvatarToR2({
  asset,
  organizationId,
}: {
  asset: ImagePickerAsset;
  organizationId: string;
}) {
  return uploadImageToR2({
    asset,
    kind:
      'organization-avatar',
    organizationId,
  });
}

export async function uploadEventImageToR2({
  asset,
  eventId,
  organizationId,
}: {
  asset: ImagePickerAsset;
  eventId: string;
  organizationId: string;
}) {
  return uploadImageToR2({
    asset,
    eventId,
    kind: 'event-image',
    organizationId,
  });
}

async function uploadImageToR2({
  asset,
  eventId = null,
  kind,
  organizationId = null,
}: {
  asset: ImagePickerAsset;
  eventId?: string | null;
  kind: MediaKind;
  organizationId?:
    string | null;
}) {
  const contentType =
    getAssetContentType(
      asset
    );

  /*
   * Read the image before asking the
   * server for an upload URL.
   *
   * That prevents us from creating an
   * upload slot when the local asset
   * cannot even be read.
   */
  const fileBody =
    await readAsset(
      asset
    );

  const fileSize =
    fileBody.byteLength;

  const accessToken =
    await getAccessToken();

  const body: Record<
    string,
    unknown
  > = {
    contentType,
    fileSize,
    kind,
  };

  if (
    kind === 'post' ||
    kind ===
      'organization-avatar' ||
    kind ===
      'event-image'
  ) {
    body.organizationId =
      organizationId;
  }

  if (
    kind ===
    'event-image'
  ) {
    body.eventId =
      eventId;
  }

  const {
    data,
    error,
  } =
    await supabase.functions.invoke<CreateUploadResponse>(
      'create-media-upload',
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
        body,
      }
    );

  if (error) {
    let details = '';

    try {
      if (
        'context' in
          error &&
        error.context instanceof
          Response
      ) {
        details =
          await error.context.text();
      }
    } catch {
      /*
       * Ignore response parsing
       * failure. The original upload
       * preparation error is more
       * important.
       */
    }

    console.warn(
      '[r2] Could not create upload URL.',
      error,
      details
    );

    throw new Error(
      details ||
        'Could not prepare image upload.'
    );
  }

  if (
    !data?.uploadUrl ||
    !data.objectKey ||
    !data.contentType
  ) {
    throw new Error(
      'Could not prepare image upload.'
    );
  }

  const objectKey =
    data.objectKey.trim();

  if (!objectKey) {
    throw new Error(
      'R2 returned an empty object key.'
    );
  }

  let uploadResponse:
    Response;

  try {
    /*
     * The request can fail in an
     * ambiguous way:
     *
     * R2 may receive the complete PUT
     * while the client loses its
     * connection before receiving the
     * response.
     *
     * If that happens, an object could
     * exist even though fetch() throws.
     */
    uploadResponse =
      await fetch(
        data.uploadUrl,
        {
          method:
            'PUT',

          headers: {
            'Content-Type':
              data.contentType,
          },

          body:
            fileBody,
        }
      );
  } catch (uploadError) {
    console.warn(
      '[r2] Upload request failed.',
      {
        objectKey,
      },
      uploadError
    );

    /*
     * The DB has not been mutated yet.
     *
     * If R2 happened to receive the
     * upload before the connection
     * failed, remove that unreferenced
     * object.
     */
    await cleanupFailedUpload({
      eventId,
      kind,
      objectKey,
      organizationId,
    });

    throw new Error(
      'Image upload failed. Check your connection and try again.'
    );
  }

  if (
    !uploadResponse.ok
  ) {
    let responseText =
      '';

    try {
      responseText =
        await uploadResponse.text();
    } catch {
      /*
       * Logging the status and object
       * key is enough when the response
       * body itself cannot be read.
       */
    }

    console.warn(
      '[r2] Upload failed.',
      {
        objectKey,
        responseText,
        status:
          uploadResponse.status,
      }
    );

    /*
     * A non-success response normally
     * means no object was committed,
     * but cleanup is intentionally
     * idempotent/best-effort because
     * there must never be a DB-less
     * media object if we can remove it.
     */
    await cleanupFailedUpload({
      eventId,
      kind,
      objectKey,
      organizationId,
    });

    throw new Error(
      `Image upload failed with status ${uploadResponse.status}.`
    );
  }

  return {
    objectKey,
  };
}

/*
 * Once an object key has been issued,
 * an upload failure can be ambiguous.
 *
 * Try to remove the object before
 * returning the failure to the caller.
 *
 * Cleanup failure does NOT replace the
 * original upload failure because the
 * user needs to know that publishing
 * did not complete.
 */
async function cleanupFailedUpload({
  eventId,
  kind,
  objectKey,
  organizationId,
}: {
  eventId:
    string | null;
  kind:
    MediaKind;
  objectKey:
    string;
  organizationId:
    string | null;
}) {
  try {
    await deleteMediaObjectFromR2(
      kind,
      objectKey,
      {
        eventId:
          eventId ??
          undefined,

        organizationId:
          organizationId ??
          undefined,
      }
    );
  } catch (
    cleanupError
  ) {
    console.warn(
      '[r2] Could not clean up media after failed upload.',
      {
        kind,
        objectKey,
      },
      cleanupError
    );
  }
}

export async function deletePostImageFromR2(
  objectKey: string
) {
  return deleteMediaObjectFromR2(
    'post',
    objectKey
  );
}

export async function deleteAvatarFromR2(
  objectKey: string
) {
  return deleteMediaObjectFromR2(
    'avatar',
    objectKey
  );
}

export async function deleteOrganizationAvatarFromR2({
  objectKey,
  organizationId,
}: {
  objectKey: string;
  organizationId: string;
}) {
  return deleteMediaObjectFromR2(
    'organization-avatar',
    objectKey,
    {
      organizationId,
    }
  );
}

export async function deleteEventImageFromR2({
  eventId,
  objectKey,
  organizationId,
}: {
  eventId: string;
  objectKey: string;
  organizationId: string;
}) {
  return deleteMediaObjectFromR2(
    'event-image',
    objectKey,
    {
      eventId,
      organizationId,
    }
  );
}

async function deleteMediaObjectFromR2(
  kind: MediaKind,
  objectKey: string,
  options?: {
    eventId?: string;
    organizationId?: string;
  }
) {
  const cleanObjectKey =
    objectKey.trim();

  const requiredPrefix =
    kind === 'avatar'
      ? 'avatars/users/'
      : kind ===
          'organization-avatar'
        ? 'avatars/organizations/'
        : kind ===
            'event-image'
          ? 'events/organizations/'
          : 'posts/';

  if (
    !cleanObjectKey.startsWith(
      requiredPrefix
    )
  ) {
    throw new Error(
      'Invalid R2 media path.'
    );
  }

  const accessToken =
    await getAccessToken();

  const body: Record<
    string,
    unknown
  > = {
    kind,
    objectKey:
      cleanObjectKey,
  };

  if (
    kind ===
      'organization-avatar' ||
    kind ===
      'event-image'
  ) {
    body.organizationId =
      options?.organizationId;
  }

  if (
    kind ===
    'event-image'
  ) {
    body.eventId =
      options?.eventId;
  }

  const {
    data,
    error,
  } =
    await supabase.functions.invoke<DeleteMediaResponse>(
      'delete-media-object',
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },

        body,
      }
    );

  if (error) {
    let details = '';

    try {
      if (
        'context' in
          error &&
        error.context instanceof
          Response
      ) {
        details =
          await error.context.text();
      }
    } catch {
      /*
       * Ignore response parsing
       * failure.
       */
    }

    console.warn(
      '[r2] Could not delete media object.',
      error,
      details
    );

    throw new Error(
      details ||
        'Could not delete image.'
    );
  }

  if (
    !data?.deleted
  ) {
    throw new Error(
      'Could not delete image.'
    );
  }
}