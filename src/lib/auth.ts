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
