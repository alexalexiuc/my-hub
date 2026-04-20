/** How long a password reset token is valid (in minutes). */
export const PASSWORD_RESET_TOKEN_EXPIRY_MINUTES = 60;

/** Minimum minutes a user must wait before requesting another password reset email. */
export const RETRY_PWD_RESET_AFTER_MINS = 5;

/** How long an email verification token is valid (in minutes). */
export const EMAIL_VERIFICATION_TOKEN_EXPIRY_MINUTES = 24 * 60;

export const UNSUBSCRIBE_TOKEN_EXPIRY_MINUTES = 30 * 24 * 60; // 30 days

/** Number of consecutive failed login attempts before the account is blocked. */
export const MAX_FAILED_LOGIN_ATTEMPTS = 10;

/** Number of consecutive password-reset requests without completion before the account is blocked. */
export const MAX_FAILED_RESET_ATTEMPTS = 10;

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
