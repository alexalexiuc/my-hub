/** How long a password reset token is valid (in minutes). */
export const PASSWORD_RESET_TOKEN_EXPIRY_MINUTES = 60;

/** Minimum number of characters required for user passwords. */
export const MIN_PASSWORD_LENGTH = 8;

/** Special characters accepted in passwords. Displayed in the UI alongside the strength rules. */
export const PASSWORD_SPECIAL_CHARS = "! @ # $ % ^ & * ( ) _ + - = [ ] { } | ; ' , . / < > ? ~";

/** Per-rule regexes used for both Zod validation and the live PasswordStrength UI. */
export const PASSWORD_RULES = {
  minLength: MIN_PASSWORD_LENGTH,
  hasUppercase: /[A-Z]/,
  hasLowercase: /[a-z]/,
  hasNumber: /[0-9]/,
  hasSpecial: /[!@#$%^&*()_+\-=\[\]{}|;',./<>?~]/,
} as const;
