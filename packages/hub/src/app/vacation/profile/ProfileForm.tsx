'use client';

import { useState } from 'react';
import type { VacationProfile } from '@my-hub/shared/types';
import { Button, Card, Field, Input } from '@/components';
import { apiFetch } from '@/lib/utils';
import { blankToNull, parseOptionalNumber } from '../vacation.utils';

type ProfileFormProps = {
  profile: VacationProfile | null;
  onSaved: () => void;
};

/** Edits the vacation profile: where you work and the leave balance to count from. */
export function ProfileForm({ profile, onSaved }: ProfileFormProps) {
  const [country, setCountry] = useState(profile?.country ?? 'MD');
  const [region, setRegion] = useState(profile?.region ?? '');
  const [employer, setEmployer] = useState(profile?.employer ?? '');
  const [openingBalanceDays, setOpeningBalanceDays] = useState(profile ? String(profile.openingBalanceDays) : '');
  const [openingBalanceDate, setOpeningBalanceDate] = useState(profile?.openingBalanceDate ?? '');
  const [accrualStart, setAccrualStart] = useState(profile?.accrualStart ?? '');
  const [baseSalary, setBaseSalary] = useState(profile?.baseSalaryMdl != null ? String(profile.baseSalaryMdl) : '');
  const [saving, setSaving] = useState(false);

  const balance = parseOptionalNumber(openingBalanceDays);
  const base = parseOptionalNumber(baseSalary);
  const canSave =
    country.trim().length === 2 &&
    employer.trim() !== '' &&
    balance !== null &&
    balance >= 0 &&
    !!openingBalanceDate &&
    (base === null || base >= 0);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      await apiFetch('/api/vacation/profile', {
        method: 'PUT',
        body: {
          country: country.trim().toUpperCase(),
          region: blankToNull(region),
          employer: employer.trim(),
          openingBalanceDays: balance,
          openingBalanceDate,
          accrualStart: blankToNull(accrualStart),
          baseSalaryMdl: base,
        },
      });
      onSaved();
    } catch {
      // apiFetch already surfaced the error as a toast.
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card compact>
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Employer">
            <Input value={employer} onChange={e => setEmployer(e.target.value)} placeholder="e.g. Acme SRL" />
          </Field>
          <Field label="Country" info="Two-letter country code whose labour rules and public holidays apply.">
            <Input value={country} maxLength={2} onChange={e => setCountry(e.target.value)} placeholder="MD" />
          </Field>
          <Field
            label="Region"
            info="Locality whose hram day counts as a public holiday. Leave blank for national only."
          >
            <Input value={region} onChange={e => setRegion(e.target.value)} placeholder="e.g. Chisinau" />
          </Field>
          <Field label="Opening balance (days)" info="Unused leave days you had on the opening balance date.">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={openingBalanceDays}
              onChange={e => setOpeningBalanceDays(e.target.value)}
            />
          </Field>
          <Field
            label="Opening balance date"
            info="Leave before this date is already reflected in the opening balance; accrual starts the day after."
          >
            <Input type="date" value={openingBalanceDate} onChange={e => setOpeningBalanceDate(e.target.value)} />
          </Field>
          <Field label="Accrual start" info="Optional: when you started earning leave, if later than the balance date.">
            <Input type="date" value={accrualStart} onChange={e => setAccrualStart(e.target.value)} />
          </Field>
          <Field
            label="Base salary (gross MDL / month)"
            info="Gross. Used for months with no entry in Payments (e.g. future months) unless a projected payment covers them. Leave blank to repeat the latest payment instead."
          >
            <Input type="number" min={0} step="1" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} />
          </Field>
        </div>
        <Button type="submit" variant="accent" disabled={!canSave || saving}>
          {saving ? 'Saving…' : profile ? 'Save profile' : 'Create profile'}
        </Button>
      </form>
    </Card>
  );
}
