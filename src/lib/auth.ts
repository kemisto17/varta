import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';

import { supabase } from './supabase';

const PASSWORD_RECOVERY_SESSION_KEY =
  'varta.auth.password-recovery-session-pending';
const AUTH_CALLBACK_ROUTE = 'auth-callback';
const PASSWORD_RECOVERY_ROUTE = 'reset-password';
const AUTH_DEEP_LINK_SCHEMES = new Set([
  'varta',
  'exp',
  'exps',
  'http',
  'https',
]);
const PASSWORD_MIN_LENGTH = 8;

export const isGoogleSignInEnabled =
  process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === 'true';

function getAuthStorage() {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

function getMergedUrlParameters(url: string) {
  const parameters = new URLSearchParams();
  const queryStart = url.indexOf('?');
  const fragmentStart = url.indexOf('#');

  const query = queryStart >= 0
    ? url.slice(
        queryStart + 1,
        fragmentStart >= 0 ? fragmentStart : url.length
      )
    : '';
  const fragment = fragmentStart >= 0 ? url.slice(fragmentStart + 1) : '';

  for (const encodedParameters of [query, fragment]) {
    const nextParameters = new URLSearchParams(encodedParameters);

    nextParameters.forEach((value, key) => {
      parameters.set(key, value);
    });
  }

  return parameters;
}

function getDeepLinkRoute(url: string) {
  const parsedUrl = Linking.parse(url);
  const scheme = parsedUrl.scheme?.toLowerCase();
  const hostname = parsedUrl.hostname
    ?.replace(/^\/+|\/+$/g, '')
    .toLowerCase();
  const path = parsedUrl.path
    ?.replace(/^\/+|\/+$/g, '')
    .toLowerCase();

  if (!scheme || !AUTH_DEEP_LINK_SCHEMES.has(scheme)) {
    return null;
  }

  if (scheme === 'varta') {
    return [hostname, path].filter(Boolean).join('/');
  }

  return path ?? '';
}

export function beginPasswordRecoverySession() {
  try {
    const storage = getAuthStorage();

    if (!storage) {
      return false;
    }

    storage.setItem(PASSWORD_RECOVERY_SESSION_KEY, 'true');
    return true;
  } catch {
    return false;
  }
}

export function clearPendingPasswordRecoverySession() {
  try {
    getAuthStorage()?.removeItem(PASSWORD_RECOVERY_SESSION_KEY);
  } catch {
    // A failed removal keeps the recovery session hidden on the next launch.
  }
}

export function hasPendingPasswordRecoverySession() {
  try {
    return getAuthStorage()?.getItem(PASSWORD_RECOVERY_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

export function createPasswordRecoveryRedirectUrl() {
  return Linking.createURL(PASSWORD_RECOVERY_ROUTE);
}

export function createAuthCallbackRedirectUrl() {
  return Linking.createURL(AUTH_CALLBACK_ROUTE);
}

export function isAuthCallbackUrl(url: string | null | undefined) {
  if (!url) {
    return false;
  }

  try {
    return getDeepLinkRoute(url) === AUTH_CALLBACK_ROUTE;
  } catch {
    return false;
  }
}

export async function completeAuthCallbackFromUrl(
  url: string
): Promise<Session | null> {
  const parameters = getMergedUrlParameters(url);
  const errorDescription =
    parameters.get('error_description') ??
    parameters.get('error') ??
    parameters.get('error_code');

  if (errorDescription) {
    throw new Error(errorDescription);
  }

  const accessToken = parameters.get('access_token');
  const refreshToken = parameters.get('refresh_token');

  if (accessToken && refreshToken) {
    const {
      data: { session },
      error,
    } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      throw error;
    }

    return session;
  }

  const code = parameters.get('code');

  if (code) {
    const {
      data: { session },
      error,
    } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      throw error;
    }

    return session;
  }

  throw new Error('The sign-in response did not include an authorization code.');
}

export async function startGoogleSignIn() {
  if (!isGoogleSignInEnabled) {
    throw new Error('Google OAuth provider is not enabled.');
  }

  const redirectTo = createAuthCallbackRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        prompt: 'select_account',
      },
    },
  });

  if (error) {
    throw error;
  }

  if (!data.url) {
    throw new Error('Google sign-in is not available.');
  }

  await Linking.openURL(data.url);
}

export function isPasswordRecoveryUrl(url: string | null | undefined) {
  if (!url) {
    return false;
  }

  try {
    return getDeepLinkRoute(url) === PASSWORD_RECOVERY_ROUTE;
  } catch {
    return false;
  }
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^\S+@\S+\.\S+$/.test(normalizeEmail(email));
}

export function getPasswordPolicyMessage(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters for your password.`;
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Use at least one letter and one number in your password.';
  }

  return null;
}

export function getAuthErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes('invalid login credentials')) {
    return 'That email or password is incorrect.';
  }

  if (normalizedMessage.includes('email not confirmed')) {
    return 'Confirm your email before signing in.';
  }

  if (
    normalizedMessage.includes('provider') ||
    normalizedMessage.includes('oauth')
  ) {
    return 'Google sign-in is not ready yet. Try email and password for now.';
  }

  if (normalizedMessage.includes('user already registered')) {
    return 'An account already exists for this email.';
  }

  if (normalizedMessage.includes('weak password')) {
    return 'Use a stronger password with at least one letter and one number.';
  }

  if (normalizedMessage.includes('password')) {
    return message;
  }

  return 'Something went wrong. Please try again.';
}
