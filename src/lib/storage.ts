import { File as ExpoFile } from 'expo-file-system';

import { supabase } from './supabase';

export type ImageContentType =
  | 'image/heic'
  | 'image/heif'
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp';

type LocalImageSource = {
  file?: { arrayBuffer: () => Promise<ArrayBuffer> } | null;
  fileName?: string | null;
  mimeType?: string | null;
  uri: string;
};

type UploadImageInput = {
  bucket: string;
  cacheControl?: string;
  maxBytes: number;
  pathBase: string;
  source: LocalImageSource;
};

type ImageDetails = {
  contentType: ImageContentType;
  extension: 'heic' | 'heif' | 'jpg' | 'png' | 'webp';
};

export type ImageUploadErrorCode =
  | 'invalid-image'
  | 'invalid-path'
  | 'read-failed'
  | 'too-large'
  | 'type-mismatch'
  | 'upload-failed';

export class ImageUploadError extends Error {
  readonly code: ImageUploadErrorCode;
  readonly originalError: unknown;

  constructor(
    code: ImageUploadErrorCode,
    message: string,
    originalError: unknown = null
  ) {
    super(message);
    this.name = 'ImageUploadError';
    this.code = code;
    this.originalError = originalError;
  }
}

const IMAGE_DETAILS: Record<ImageContentType, ImageDetails> = {
  'image/heic': { contentType: 'image/heic', extension: 'heic' },
  'image/heif': { contentType: 'image/heif', extension: 'heif' },
  'image/jpeg': { contentType: 'image/jpeg', extension: 'jpg' },
  'image/png': { contentType: 'image/png', extension: 'png' },
  'image/webp': { contentType: 'image/webp', extension: 'webp' },
};

const MIME_ALIASES: Record<string, ImageContentType> = {
  'image/heic': 'image/heic',
  'image/heif': 'image/heif',
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
};

const EXTENSION_TYPES: Record<string, ImageContentType> = {
  heic: 'image/heic',
  heif: 'image/heif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const HEIC_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'hevm',
  'hevs',
]);
const GENERIC_HEIF_BRANDS = new Set(['heif', 'mif1', 'msf1']);

export async function uploadImage({
  bucket,
  cacheControl = '3600',
  maxBytes,
  pathBase,
  source,
}: UploadImageInput) {
  validatePathBase(pathBase);

  const fileBody = await readLocalImage(source);

  if (fileBody.byteLength > maxBytes) {
    const maxMegabytes = Math.round(maxBytes / (1024 * 1024));
    throw new ImageUploadError(
      'too-large',
      `Choose an image smaller than ${maxMegabytes} MB.`
    );
  }

  const hintedType = getHintedContentType(source);
  const detectedDetails = detectImageDetails(fileBody, hintedType);

  if (!detectedDetails) {
    throw new ImageUploadError(
      'invalid-image',
      'The selected file is not a valid JPG, PNG, WebP, HEIC, or HEIF image.'
    );
  }

  if (
    hintedType &&
    hintedType !== detectedDetails.contentType &&
    !(isHeifType(hintedType) && isHeifType(detectedDetails.contentType))
  ) {
    throw new ImageUploadError(
      'type-mismatch',
      'The selected file does not match its reported image type.'
    );
  }

  const path = `${pathBase}.${detectedDetails.extension}`;

  const { error } = await supabase.storage.from(bucket).upload(path, fileBody, {
    cacheControl,
    contentType: detectedDetails.contentType,
    upsert: false,
  });

  if (error) {
    throw new ImageUploadError(
      'upload-failed',
      'The image could not be uploaded. Check your connection and try again.',
      error
    );
  }

  return {
    byteLength: fileBody.byteLength,
    contentType: detectedDetails.contentType,
    path,
  };
}

export async function createPrivateImageUrl(
  bucket: string,
  path: string,
  expiresIn = 5 * 60
) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}

export async function createPrivateImageUrls(
  bucket: string,
  paths: string[],
  expiresIn = 60 * 60
) {
  const urls = new Map<string, string>();
  const uniquePaths = [...new Set(paths)];

  if (uniquePaths.length === 0) {
    return urls;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(uniquePaths, expiresIn);

  if (error) {
    throw error;
  }

  data.forEach((item) => {
    if (!item.error && item.path && item.signedUrl) {
      urls.set(item.path, item.signedUrl);
    }
  });

  return urls;
}

export function createStorageObjectId() {
  const randomPart = () => Math.random().toString(36).slice(2, 12);

  return `${Date.now().toString(36)}-${randomPart()}-${randomPart()}`;
}

export function isImageUploadError(error: unknown): error is ImageUploadError {
  return error instanceof ImageUploadError;
}

async function readLocalImage(source: LocalImageSource) {
  try {
    const fileBody = source.file
      ? await source.file.arrayBuffer()
      : await new ExpoFile(source.uri).arrayBuffer();

    if (fileBody.byteLength === 0) {
      throw new ImageUploadError('read-failed', 'The selected image is empty.');
    }

    return fileBody;
  } catch (error) {
    if (isImageUploadError(error)) {
      throw error;
    }

    throw new ImageUploadError(
      'read-failed',
      'The selected image could not be read from this device.',
      error
    );
  }
}

function getHintedContentType(source: LocalImageSource) {
  const normalizedMimeType = source.mimeType?.toLowerCase();

  if (normalizedMimeType && normalizedMimeType in MIME_ALIASES) {
    return MIME_ALIASES[normalizedMimeType];
  }

  const fileName = (source.fileName ?? source.uri).split(/[?#]/)[0];
  const extension = fileName.split('.').pop()?.toLowerCase();

  return extension ? (EXTENSION_TYPES[extension] ?? null) : null;
}

function detectImageDetails(
  fileBody: ArrayBuffer,
  hintedType: ImageContentType | null
): ImageDetails | null {
  const bytes = new Uint8Array(fileBody);

  if (matches(bytes, [0xff, 0xd8, 0xff])) {
    return IMAGE_DETAILS['image/jpeg'];
  }

  if (matches(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return IMAGE_DETAILS['image/png'];
  }

  if (readAscii(bytes, 0, 4) === 'RIFF' && readAscii(bytes, 8, 12) === 'WEBP') {
    return IMAGE_DETAILS['image/webp'];
  }

  if (readAscii(bytes, 4, 8) === 'ftyp') {
    const brand = readAscii(bytes, 8, 12);

    if (HEIC_BRANDS.has(brand)) {
      return IMAGE_DETAILS['image/heic'];
    }

    if (GENERIC_HEIF_BRANDS.has(brand) && hintedType && isHeifType(hintedType)) {
      return IMAGE_DETAILS[hintedType];
    }
  }

  return null;
}

function matches(bytes: Uint8Array, signature: number[]) {
  return (
    bytes.length >= signature.length &&
    signature.every((value, index) => bytes[index] === value)
  );
}

function readAscii(bytes: Uint8Array, start: number, end: number) {
  if (bytes.length < end) {
    return '';
  }

  return String.fromCharCode(...bytes.slice(start, end));
}

function isHeifType(contentType: ImageContentType) {
  return contentType === 'image/heic' || contentType === 'image/heif';
}

function validatePathBase(pathBase: string) {
  if (
    !/^[a-zA-Z0-9/_-]+$/.test(pathBase) ||
    pathBase.startsWith('/') ||
    pathBase.endsWith('/') ||
    pathBase.includes('//') ||
    pathBase.includes('..')
  ) {
    throw new ImageUploadError('invalid-path', 'The image path is invalid.');
  }
}
