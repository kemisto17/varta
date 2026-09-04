import * as Linking from 'expo-linking';

const PASSWORD_RECOVERY_SESSION_KEY =
  'varta.auth.password-recovery-session-pending';
const PASSWORD_RECOVERY_ROUTE = 'reset-password';
const PASSWORD_RECOVERY_SCHEMES = new Set([
  'varta',
  'exp',
  'exps',
  'http',
  'https',
]);

function getAuthStorage() {
  return typeof localStorage === 'undefined' ? null : localStorage;
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

export function isPasswordRecoveryUrl(url: string | null | undefined) {
  if (!url) {
    return false;
  }

  try {
    const parsedUrl = Linking.parse(url);
    const scheme = parsedUrl.scheme?.toLowerCase();
    const hostname = parsedUrl.hostname
      ?.replace(/^\/+|\/+$/g, '')
      .toLowerCase();
    const path = parsedUrl.path
      ?.replace(/^\/+|\/+$/g, '')
      .toLowerCase();

    if (!scheme || !PASSWORD_RECOVERY_SCHEMES.has(scheme)) {
      return false;
    }

    if (scheme === 'varta') {
      return (
        [hostname, path].filter(Boolean).join('/') ===
        PASSWORD_RECOVERY_ROUTE
      );
    }

    return path === PASSWORD_RECOVERY_ROUTE;
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

export function getAuthErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes('invalid login credentials')) {
    return 'That email or password is incorrect.';
  }

  if (normalizedMessage.includes('email not confirmed')) {
    return 'Confirm your email before signing in.';
  }

  if (normalizedMessage.includes('user already registered')) {
    return 'An account already exists for this email.';
  }

  if (normalizedMessage.includes('password')) {
    return message;
  }

  return 'Something went wrong. Please try again.';
}
