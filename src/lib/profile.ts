import { supabase } from './supabase';
import type { Tables, TablesInsert } from '../types/database';

export type InstituteOption = Pick<
  Tables<'institutes'>,
  'id' | 'name' | 'short_name'
>;

export type CreateStudentProfileInput = Omit<
  TablesInsert<'profiles'>,
  'avatar_path' | 'bio' | 'created_at' | 'updated_at'
>;

export async function getStudentProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getInstitutes() {
  const { data, error } = await supabase
    .from('institutes')
    .select('id, name, short_name')
    .order('name');

  if (error) {
    throw error;
  }

  return data;
}

export async function createStudentProfile(
  input: CreateStudentProfileInput
) {
  const { data, error } = await supabase
    .from('profiles')
    .insert(input)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export function normalizeUsername(username: string) {
  return username.trim().replace(/^@/, '').toLowerCase();
}

export function getProfileCreationErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null) {
    const code = 'code' in error ? String(error.code) : '';
    const message = 'message' in error ? String(error.message) : '';

    if (
      code === '23505' &&
      (message.includes('username') || message.includes('profiles_username_key'))
    ) {
      return 'That username is already taken. Try another one.';
    }
  }

  return 'We could not create your profile. Check your connection and try again.';
}
