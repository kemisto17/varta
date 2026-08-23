import type { ImagePickerAsset } from 'expo-image-picker';

import type {
  StudentVerification,
  VerificationStatus,
} from '../contexts/VerificationContext';
import {
  createPrivateImageUrl,
  createStorageObjectId,
  isImageUploadError,
  uploadImage,
} from './storage';
import { supabase } from './supabase';

export const VERIFICATION_BUCKET = 'verification-documents';
export const MAX_VERIFICATION_FILE_SIZE = 5 * 1024 * 1024;

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
  const { data: institute, error: instituteError } = await supabase
    .from('institutes')
    .select('university_id')
    .eq('id', instituteId)
    .single();

  if (instituteError) {
    throw instituteError;
  }

  const upload = await uploadImage({
    bucket: VERIFICATION_BUCKET,
    cacheControl: '0',
    maxBytes: MAX_VERIFICATION_FILE_SIZE,
    pathBase: `${userId}/student-id-${createStorageObjectId()}`,
    source: asset,
  });
  const documentPath = upload.path;

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
  if (isImageUploadError(error)) {
    return error.message;
  }

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

export function getVerificationDocumentUrl(documentPath: string) {
  return createPrivateImageUrl(VERIFICATION_BUCKET, documentPath);
}
