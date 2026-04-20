/**
 * API-level Zod schemas for auth endpoints (forgot-password, reset-password).
 */
import { z } from 'zod';
import { MIN_PASSWORD_LENGTH, PASSWORD_RULES } from '../../constants/auth';

export const ForgotPasswordSchema = z.object({
  email: z.string().trim().email('A valid email address is required'),
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

const passwordField = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .regex(PASSWORD_RULES.hasUppercase, 'Password must contain at least one uppercase letter')
  .regex(PASSWORD_RULES.hasLowercase, 'Password must contain at least one lowercase letter')
  .regex(PASSWORD_RULES.hasNumber, 'Password must contain at least one number')
  .regex(PASSWORD_RULES.hasSpecial, 'Password must contain at least one special character');

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1, 'token is required'),
    password: passwordField,
    confirm: z.string(),
  })
  .refine(data => data.password === data.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export const RegisterPasswordSchema = z
  .object({
    password: passwordField,
    confirm: z.string(),
  })
  .refine(data => data.password === data.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

export type RegisterPasswordInput = z.infer<typeof RegisterPasswordSchema>;
