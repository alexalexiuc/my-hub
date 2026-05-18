'use client';

import { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ResetPasswordSchema, type ResetPasswordInput } from '@/lib/schemas/auth';
import { apiFetch, ApiError } from '@/lib/utils';
import { Button, Field, PasswordInput, PasswordStrength } from '@/components';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: { token },
  });

  async function onSubmit(data: ResetPasswordInput) {
    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: { token: data.token, password: data.password, confirm: data.confirm },
        silentToast: true,
      });
      setSuccess(true);
    } catch (e) {
      setError('root', {
        message: e instanceof ApiError ? e.message : 'Something went wrong. Please try again.',
      });
    }
  }

  if (!token) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-zinc-950 overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[500px] w-[500px] rounded-full bg-indigo-600/20 blur-[120px]" />
        </div>
        <div className="relative z-10 w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl shadow-black/50 text-center space-y-4">
          <h1 className="text-2xl font-bold">Invalid link</h1>
          <p className="text-sm text-zinc-400">This password reset link is missing or malformed.</p>
          <Link href="/auth/forgot-password" className="text-sm text-indigo-400 hover:underline">
            Request a new one
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-zinc-950 overflow-hidden">
      {/* Decorative glow */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[500px] rounded-full bg-indigo-600/20 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl shadow-black/50">
        <h1 className="mb-6 text-2xl font-bold text-center">Reset password</h1>

        {success ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-zinc-400">
              Your password has been updated. You can now sign in with your new password.
            </p>
            <Link href="/auth/signin" className="text-sm text-indigo-400 hover:underline">
              Sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <Field label="New password">
              <PasswordInput id="password" placeholder="••••••••" autoFocus {...register('password')} />
              {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>}
            </Field>
            <Field label="Confirm new password">
              <PasswordInput id="confirm" placeholder="••••••••" {...register('confirm')} />
            </Field>
            <PasswordStrength password={watch('password') ?? ''} confirm={watch('confirm') ?? ''} />
            {errors.root && <p className="text-sm text-red-400">{errors.root.message}</p>}
            <Button type="submit" loading={isSubmitting} className="w-full">
              Update password
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-zinc-400">Loading…</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
