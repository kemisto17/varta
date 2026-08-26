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

function getAssetContentType(asset: ImagePickerAsset) {
  if (asset.mimeType) {
    return asset.mimeType;
  }

  const uri = asset.uri.toLowerCase();

  if (uri.endsWith('.png')) return 'image/png';
  if (uri.endsWith('.webp')) return 'image/webp';
  if (uri.endsWith('.heic')) return 'image/heic';
  if (uri.endsWith('.heif')) return 'image/heif';

  return 'image/jpeg';
}

function base64ToArrayBuffer(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

async function readAsset(asset: ImagePickerAsset) {
  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (!base64) {
    throw new Error('Selected image could not be read.');
  }

  return base64ToArrayBuffer(base64);
}

async function getAccessToken() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (!session?.access_token) {
    throw new Error('You must be signed in.');
  }

  return session.access_token;
}

export async function uploadPostImageToR2({
  asset,
  organizationId,
}: {
  asset: ImagePickerAsset;
  organizationId?: string | null;
}) {
  const contentType = getAssetContentType(asset);
  const fileBody = await readAsset(asset);
  const fileSize = asset.fileSize ?? fileBody.byteLength;

  const accessToken = await getAccessToken();

  const { data, error } =
    await supabase.functions.invoke<CreateUploadResponse>(
      'create-media-upload',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: {
          contentType,
          fileSize,
          kind: 'post',
          organizationId: organizationId ?? null,
        },
      }
    );

  if (error) {
    let details = '';

    try {
      if ('context' in error && error.context instanceof Response) {
        details = await error.context.text();
      }
    } catch {
      // Ignore response parsing failure.
    }

    console.warn(
      '[r2] Could not create upload URL.',
      error,
      details
    );

    throw new Error(
      details || 'Could not prepare image upload.'
    );
  }

  if (!data?.uploadUrl || !data.objectKey || !data.contentType) {
    throw new Error('Could not prepare image upload.');
  }

  const objectKey = data.objectKey.trim();

  if (!objectKey) {
    throw new Error('R2 returned an empty object key.');
  }

  const uploadResponse = await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': data.contentType,
    },
    body: fileBody,
  });

  if (!uploadResponse.ok) {
    const responseText = await uploadResponse.text();

    console.warn('[r2] Upload failed.', {
      status: uploadResponse.status,
      responseText,
      objectKey,
    });

    throw new Error(
      `Image upload failed with status ${uploadResponse.status}.`
    );
  }

  return {
    objectKey,
  };
}

export async function deletePostImageFromR2(
  objectKey: string
) {
  const cleanObjectKey = objectKey.trim();

  if (!cleanObjectKey.startsWith('posts/')) {
    throw new Error('Invalid R2 post media path.');
  }

  const accessToken = await getAccessToken();

  const { data, error } =
    await supabase.functions.invoke<DeleteMediaResponse>(
      'delete-media-object',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: {
          kind: 'post',
          objectKey: cleanObjectKey,
        },
      }
    );

  if (error) {
    let details = '';

    try {
      if ('context' in error && error.context instanceof Response) {
        details = await error.context.text();
      }
    } catch {
      // Ignore response parsing failure.
    }

    console.warn(
      '[r2] Could not delete media object.',
      error,
      details
    );

    throw new Error(
      details || 'Could not delete image.'
    );
  }

  if (!data?.deleted) {
    throw new Error('Could not delete image.');
  }
}