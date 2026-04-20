'use client';

import { PASSWORD_RULES, PASSWORD_SPECIAL_CHARS } from '@my-hub/shared/constants';

type PasswordStrengthProps = {
  password: string;
  confirm?: string;
};

export function PasswordStrength({ password, confirm }: PasswordStrengthProps) {
  const hasInput = password.length > 0;

  const rules = [
    { label: `At least ${PASSWORD_RULES.minLength} characters`, met: password.length >= PASSWORD_RULES.minLength },
    { label: 'One uppercase letter', met: PASSWORD_RULES.hasUppercase.test(password) },
    { label: 'One lowercase letter', met: PASSWORD_RULES.hasLowercase.test(password) },
    { label: 'One number', met: PASSWORD_RULES.hasNumber.test(password) },
    { label: `One special character: ${PASSWORD_SPECIAL_CHARS}`, met: PASSWORD_RULES.hasSpecial.test(password) },
  ];

  const showMatch = typeof confirm === 'string' && confirm.length > 0;
  const passwordsMatch = password === confirm;

  return (
    <div className="mt-2 space-y-1">
      {rules.map(rule => (
        <RuleRow key={rule.label} label={rule.label} met={rule.met} hasInput={hasInput} />
      ))}
      {showMatch && (
        <RuleRow label={passwordsMatch ? 'Passwords match' : 'Passwords do not match'} met={passwordsMatch} hasInput />
      )}
    </div>
  );
}

type RuleRowProps = { label: string; met: boolean; hasInput: boolean };

function RuleRow({ label, met, hasInput }: RuleRowProps) {
  const color = !hasInput ? 'text-zinc-500' : met ? 'text-green-400' : 'text-red-400';
  const icon = !hasInput ? '○' : met ? '✓' : '✗';
  return (
    <div className="flex items-start gap-1.5 text-xs">
      <span className={`${color} shrink-0 leading-4`}>{icon}</span>
      <span className={hasInput ? (met ? 'text-zinc-300' : 'text-zinc-400') : 'text-zinc-500'}>{label}</span>
    </div>
  );
}
