'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { ForgotPasswordSchema, type ForgotPasswordInput } from '@my-hub/shared/schemas';
import { apiFetch } from '@/lib/utils';
import { Button, Field, Input } from '@/components';

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startCountdown(seconds: number) {
    setCountdown(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(ForgotPasswordSchema),
  });

  async function onSubmit(data: ForgotPasswordInput) {
    const res = await apiFetch<{ ok: boolean; retryAfter?: number }>('/api/auth/forgot-password', {
      method: 'POST',
      body: data,
      silentToast: true,
    });
    if (res?.retryAfter) {
      startCountdown(res.retryAfter);
    }
    setSubmitted(true);
  }

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;
  const countdownLabel = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-zinc-950 overflow-hidden">
      {/* Decorative glow */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[500px] rounded-full bg-indigo-600/20 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl shadow-black/50">
        <h1 className="mb-2 text-2xl font-bold text-center">Forgot password</h1>

        {submitted ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-zinc-400">
              If an account with that email exists, we&apos;ve sent a password reset link. Check your inbox.
            </p>
            {countdown > 0 && (
              <p className="text-xs text-zinc-500">
                You can request another link in <span className="font-medium text-zinc-300">{countdownLabel}</span>.
              </p>
            )}
            <Link href="/auth/signin" className="text-sm text-indigo-400 hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-zinc-400 text-center">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <Field label="Email">
                <Input id="email" type="email" placeholder="you@example.com" autoFocus {...register('email')} />
                {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
              </Field>
              <Button type="submit" loading={isSubmitting} className="w-full">
                Send reset link
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-zinc-400">
              Remembered your password?{' '}
              <Link href="/auth/signin" className="text-indigo-400 hover:underline">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
