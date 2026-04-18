/**
 * API-level Zod schemas for auth endpoints (forgot-password, reset-password).
 */
import { z } from 'zod';
import { MIN_PASSWORD_LENGTH } from '../../constants/auth';

export const ForgotPasswordSchema = z.object({
  email: z.string().trim().email('A valid email address is required'),
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1, 'token is required'),
    password: z.string().min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
    confirm: z.string(),
  })
  .refine(data => data.password === data.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
