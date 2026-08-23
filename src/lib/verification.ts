import type { ImagePickerAsset } from 'expo-image-picker';

import type {
  StudentVerification,
  VerificationStatus,
} from '../contexts/VerificationContext';
import { supabase } from './supabase';

export const VERIFICATION_BUCKET = 'verification-documents';
export const MAX_VERIFICATION_FILE_SIZE = 5 * 1024 * 1024;

const MIME_TYPE_DETAILS = {
  'image/heic': { extension: 'heic', contentType: 'image/heic' },
  'image/heif': { extension: 'heif', contentType: 'image/heif' },
  'image/jpeg': { extension: 'jpg', contentType: 'image/jpeg' },
  'image/jpg': { extension: 'jpg', contentType: 'image/jpeg' },
  'image/png': { extension: 'png', contentType: 'image/png' },
  'image/webp': { extension: 'webp', contentType: 'image/webp' },
} as const;

type SubmitVerificationInput = {
  asset: ImagePickerAsset;
  enrollmentNumber: string;
  instituteId: string;
  userId: string;
};

export async function getStudentVerification(userId: string) {
  const { data, error } = await supabase
    .from('student_verifications')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export function getVerificationStatus(
  verification: StudentVerification | null
): VerificationStatus {
  if (!verification) {
    return 'missing';
  }

  if (
    verification.status === 'pending' ||
    verification.status === 'rejected' ||
    verification.status === 'verified'
  ) {
    return verification.status;
  }

  throw new Error(`Unsupported verification status: ${verification.status}`);
}

export async function submitStudentVerification({
  asset,
  enrollmentNumber,
  instituteId,
  userId,
}: SubmitVerificationInput) {
  const uploadDetails = getUploadDetails(asset);
  const documentPath = `${userId}/student-id.${uploadDetails.extension}`;

  const { data: institute, error: instituteError } = await supabase
    .from('institutes')
    .select('university_id')
    .eq('id', instituteId)
    .single();

  if (instituteError) {
    throw instituteError;
  }

  const fileBody = await readImageAsset(asset);

  if (fileBody.byteLength > MAX_VERIFICATION_FILE_SIZE) {
    throw new Error('The selected image is larger than 5 MB.');
  }

  const { error: uploadError } = await supabase.storage
    .from(VERIFICATION_BUCKET)
    .upload(documentPath, fileBody, {
      cacheControl: '0',
      contentType: uploadDetails.contentType,
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: verification, error: insertError } = await supabase
    .from('student_verifications')
    .insert({
      enrollment_number: enrollmentNumber,
      id_document_path: documentPath,
      university_id: institute.university_id,
      user_id: userId,
    })
    .select('*')
    .single();

  if (insertError) {
    await supabase.storage.from(VERIFICATION_BUCKET).remove([documentPath]);
    throw insertError;
  }

  return verification;
}

export async function deleteRejectedVerification(
  verification: StudentVerification
) {
  if (verification.status !== 'rejected') {
    throw new Error('Only rejected verifications can be resubmitted.');
  }

  if (verification.id_document_path) {
    const { error: storageError } = await supabase.storage
      .from(VERIFICATION_BUCKET)
      .remove([verification.id_document_path]);

    if (storageError) {
      throw storageError;
    }
  }

  const { error } = await supabase
    .from('student_verifications')
    .delete()
    .eq('user_id', verification.user_id);

  if (error) {
    throw error;
  }
}

export function getVerificationErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (
      error.message.includes('larger than 5 MB') ||
      error.message.includes('could not be read') ||
      error.message.startsWith('Choose a JPG')
    ) {
      return error.message;
    }
  }

  if (typeof error === 'object' && error !== null) {
    const code = 'code' in error ? String(error.code) : '';
    const message = 'message' in error ? String(error.message).toLowerCase() : '';

    if (code === '23505' && message.includes('enrollment')) {
      return 'That enrollment number is already linked to an account.';
    }

    if (message.includes('duplicate') || message.includes('already exists')) {
      return 'A verification document already exists. Refresh and try again.';
    }
  }

  return 'We could not submit your verification. Check your connection and try again.';
}

export function getVerificationResetErrorMessage() {
  return 'We could not prepare a new submission. Check your connection and try again.';
}

function getUploadDetails(asset: ImagePickerAsset) {
  const mimeType = asset.mimeType?.toLowerCase();

  if (mimeType && mimeType in MIME_TYPE_DETAILS) {
    return MIME_TYPE_DETAILS[mimeType as keyof typeof MIME_TYPE_DETAILS];
  }

  const fileName = asset.fileName ?? asset.uri;
  const extension = fileName.split('.').pop()?.toLowerCase().split('?')[0];

  if (extension === 'jpg' || extension === 'jpeg') {
    return MIME_TYPE_DETAILS['image/jpeg'];
  }

  if (extension === 'png') {
    return MIME_TYPE_DETAILS['image/png'];
  }

  if (extension === 'webp') {
    return MIME_TYPE_DETAILS['image/webp'];
  }

  if (extension === 'heic') {
    return MIME_TYPE_DETAILS['image/heic'];
  }

  if (extension === 'heif') {
    return MIME_TYPE_DETAILS['image/heif'];
  }

  throw new Error('Choose a JPG, PNG, WebP, HEIC, or HEIF image.');
}

async function readImageAsset(asset: ImagePickerAsset) {
  try {
    const fileBody = asset.file
      ? await asset.file.arrayBuffer()
      : await fetch(asset.uri).then((response) => response.arrayBuffer());

    if (fileBody.byteLength === 0) {
      throw new Error('The selected image is empty.');
    }

    return fileBody;
  } catch {
    throw new Error('The selected image could not be read.');
  }
}
