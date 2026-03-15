'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import SectionCard from '@/components/section-card';
import Field from '@/components/field';
import Button from '@/components/button';

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

type Feature = 'meals' | 'measurements' | 'calories_profile';

const DATA_FEATURES: { key: Feature; label: string; description: string }[] = [
  {
    key: 'meals',
    label: 'Meal logs',
    description: 'All logged meals and their nutritional data',
  },
  {
    key: 'measurements',
    label: 'Body measurements',
    description: 'All recorded body measurements (weight, height, etc.)',
  },
  {
    key: 'calories_profile',
    label: 'Calorie profile',
    description: 'Health profile settings (age, sex, activity level, goals)',
  },
];

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [nameForm, setNameForm] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);

  const [selectedFeatures, setSelectedFeatures] = useState<Set<Feature>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteResults, setDeleteResults] = useState<Record<string, { deleted: number | boolean }> | null>(null);

  useEffect(() => {
    fetch('/api/user/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setUser(data);
          setNameForm(data.name ?? '');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveName() {
    if (!nameForm.trim()) return;
    setNameSaving(true);
    setNameSuccess(false);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameForm.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser((u) => (u ? { ...u, name: data.name } : u));
        setNameSuccess(true);
        setTimeout(() => setNameSuccess(false), 3000);
      }
    } finally {
      setNameSaving(false);
    }
  }

  function toggleFeature(key: Feature) {
    setSelectedFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setDeleteConfirm(false);
    setDeleteResults(null);
  }

  async function confirmDelete() {
    if (selectedFeatures.size === 0) return;
    setDeleting(true);
    setDeleteResults(null);
    try {
      const res = await fetch('/api/user/delete-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: Array.from(selectedFeatures) }),
      });
      if (res.ok) {
        const data = await res.json();
        setDeleteResults(data.results);
        setSelectedFeatures(new Set());
        setDeleteConfirm(false);
      }
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <div className="text-gray-400">Loading…</div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-8 space-y-6">
      <PageHeader title="Profile" backHref="/" backLabel="← Home" />

      {/* Account info */}
      <SectionCard title="Account">
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Email</span>
            <span className="font-medium">{user?.email ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Member since</span>
            <span className="font-medium">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
            </span>
          </div>
        </div>
      </SectionCard>

      {/* Edit name */}
      <SectionCard title="Display name">
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Your display name is shown across the app and in your calorie profile.
          </p>
          <div className="flex gap-2 items-end">
            <Field label="Name" className="flex-1">
              <input
                className="input"
                value={nameForm}
                placeholder="Enter your name"
                onChange={(e) => {
                  setNameForm(e.target.value);
                  setNameSuccess(false);
                }}
                onKeyDown={(e) => e.key === 'Enter' && saveName()}
              />
            </Field>
            <Button onClick={saveName} loading={nameSaving} disabled={!nameForm.trim()}>
              {nameSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
          {nameSuccess && <p className="text-sm text-green-600">Name updated.</p>}
        </div>
      </SectionCard>

      {/* Data deletion */}
      <SectionCard title="Data deletion">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Permanently delete your data by feature. This action cannot be undone.
          </p>

          <div className="space-y-2">
            {DATA_FEATURES.map(({ key, label, description }) => (
              <label
                key={key}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${
                  selectedFeatures.has(key)
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedFeatures.has(key)}
                  onChange={() => toggleFeature(key)}
                  className="mt-0.5 accent-red-600"
                />
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                </div>
              </label>
            ))}
          </div>

          {selectedFeatures.size > 0 && !deleteConfirm && (
            <Button
              variant="danger"
              onClick={() => setDeleteConfirm(true)}
              disabled={selectedFeatures.size === 0}
            >
              Delete selected data…
            </Button>
          )}

          {deleteConfirm && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
              <p className="text-sm font-medium text-red-800">
                Are you sure? This will permanently delete:
              </p>
              <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                {Array.from(selectedFeatures).map((f) => (
                  <li key={f}>{DATA_FEATURES.find((d) => d.key === f)?.label}</li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button variant="danger" loading={deleting} onClick={confirmDelete}>
                  {deleting ? 'Deleting…' : 'Yes, delete permanently'}
                </Button>
                <Button variant="secondary" onClick={() => setDeleteConfirm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {deleteResults && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-medium text-green-800 mb-2">Data deleted successfully:</p>
              <ul className="text-sm text-green-700 space-y-1">
                {Object.entries(deleteResults).map(([feature, result]) => {
                  const label = DATA_FEATURES.find((d) => d.key === feature)?.label ?? feature;
                  const count = typeof result.deleted === 'number' ? result.deleted : result.deleted ? 1 : 0;
                  return (
                    <li key={feature}>
                      {label}: {typeof result.deleted === 'number' ? `${count} records removed` : 'removed'}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Sign out */}
      <SectionCard title="Session">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Signed in as {user?.email}</p>
          <Link
            href="/api/auth/signout"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Sign out
          </Link>
        </div>
      </SectionCard>
    </main>
  );
}
