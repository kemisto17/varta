const PASSWORD_RECOVERY_SESSION_KEY =
  'varta.auth.password-recovery-session-pending';

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
