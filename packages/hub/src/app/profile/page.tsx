'use client';

import { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/SectionCard';
import { Button, Field } from '@/components';

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

type Feature = 'meals' | 'measurements' | 'calories_profile' | 'my_travels' | 'todos';

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
  {
    key: 'my_travels',
    label: 'My Travels data',
    description: 'All data related to My Travels feature (travel logs, travel meals, etc.)',
  },
  {
    key: 'todos',
    label: 'Todos',
    description: 'All data related to Todos feature (tasks, reminders, etc.)',
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
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

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

  async function deleteAll() {
    setDeletingAll(true);
    try {
      await fetch('/api/user/delete-all', { method: 'POST' });
      setDeleteAllConfirm(false);
      setDeleteResults(null);
      setSelectedFeatures(new Set());
    } finally {
      setDeletingAll(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <div className="text-zinc-400">Loading…</div>
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
            <span className="text-zinc-400">Email</span>
            <span className="font-medium">{user?.email ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Member since</span>
            <span className="font-medium">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</span>
          </div>
        </div>
      </SectionCard>

      {/* Edit name */}
      <SectionCard title="Display name">
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">
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
          {nameSuccess && <p className="text-sm text-emerald-400">Name updated.</p>}
        </div>
      </SectionCard>

      {/* Data deletion */}
      <SectionCard title="Data deletion">
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            Permanently delete your data by feature. This action cannot be undone.
          </p>

          <div className="space-y-2">
            {DATA_FEATURES.map(({ key, label, description }) => (
              <label
                key={key}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${
                  selectedFeatures.has(key)
                    ? 'border-red-700 bg-red-950/30'
                    : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
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
                  <p className="text-xs text-zinc-400 mt-0.5">{description}</p>
                </div>
              </label>
            ))}
          </div>

          {selectedFeatures.size > 0 && !deleteConfirm && (
            <Button variant="danger" onClick={() => setDeleteConfirm(true)} disabled={selectedFeatures.size === 0}>
              Delete selected data…
            </Button>
          )}

          {deleteConfirm && (
            <div className="rounded-lg border border-red-800/50 bg-red-950/30 p-4 space-y-3">
              <p className="text-sm font-medium text-red-400">Are you sure? This will permanently delete:</p>
              <ul className="list-disc list-inside text-sm text-red-400 space-y-1">
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
            <div className="rounded-lg border border-green-800/50 bg-green-950/30 p-4">
              <p className="text-sm font-medium text-green-400 mb-2">Data deleted successfully:</p>
              <ul className="text-sm text-green-400 space-y-1">
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

      {/* Danger zone */}
      <SectionCard title="Danger zone">
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">
            Permanently delete all your data (meals, measurements, calorie profile, MCP connections). Your account is
            kept.
          </p>
          {!deleteAllConfirm ? (
            <Button variant="danger" onClick={() => setDeleteAllConfirm(true)}>
              Delete all my data…
            </Button>
          ) : (
            <div className="rounded-lg border border-red-800/50 bg-red-950/30 p-4 space-y-3">
              <p className="text-sm font-medium text-red-400">
                This will permanently wipe all your data. Your account will remain. Are you sure?
              </p>
              <div className="flex gap-2">
                <Button variant="danger" loading={deletingAll} onClick={deleteAll}>
                  {deletingAll ? 'Deleting…' : 'Yes, delete everything'}
                </Button>
                <Button variant="secondary" onClick={() => setDeleteAllConfirm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Sign out */}
      <SectionCard title="Session">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-400">Signed in as {user?.email}</p>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 transition"
          >
            Sign out
          </button>
        </div>
      </SectionCard>
    </main>
  );
}
