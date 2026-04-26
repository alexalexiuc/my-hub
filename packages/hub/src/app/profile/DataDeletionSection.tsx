'use client';

import { useState } from 'react';
import { SectionCard } from '@/components/SectionCard';
import { Button, Checkbox } from '@/components';
import { apiFetch } from '@/lib/utils';

type Feature = 'meals' | 'measurements' | 'calories_profile' | 'my_travels' | 'todos' | 'finances';

const DATA_FEATURES: { key: Feature; label: string; description: string }[] = [
  { key: 'finances', label: 'Finances', description: 'All budgets, accounts, categories, and transactions' },
  { key: 'meals', label: 'Meal logs', description: 'All logged meals and their nutritional data' },
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
  { key: 'todos', label: 'Todos', description: 'All data related to Todos feature (tasks, reminders, etc.)' },
];

export function DataDeletionSection() {
  const [selectedFeatures, setSelectedFeatures] = useState<Set<Feature>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteResults, setDeleteResults] = useState<Record<string, { deleted: number | boolean }> | null>(null);

  function toggleFeature(key: Feature) {
    setSelectedFeatures(prev => {
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
      const data = await apiFetch<{ results: Record<string, { deleted: number | boolean }> }>('/api/user/delete-data', {
        method: 'POST',
        body: { features: Array.from(selectedFeatures) },
      });
      setDeleteResults(data.results);
      setSelectedFeatures(new Set());
      setDeleteConfirm(false);
    } catch {
      // ignore — apiFetch shows a global error toast
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SectionCard title="Data deletion">
      <div className="space-y-4">
        <p className="text-sm text-zinc-400">Permanently delete your data by feature. This action cannot be undone.</p>

        <div className="space-y-2">
          {DATA_FEATURES.map(({ key, label, description }) => (
            <label
              key={key}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                selectedFeatures.has(key)
                  ? 'border-red-700 bg-red-950/30'
                  : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
              }`}
            >
              <Checkbox
                checked={selectedFeatures.has(key)}
                onChange={() => toggleFeature(key)}
                className="mt-0.5 accent-red-600"
              />
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="mt-0.5 text-xs text-zinc-400">{description}</p>
              </div>
            </label>
          ))}
        </div>

        {selectedFeatures.size > 0 && !deleteConfirm && (
          <Button variant="danger" onClick={() => setDeleteConfirm(true)}>
            Delete selected data…
          </Button>
        )}

        {deleteConfirm && (
          <div className="space-y-3 rounded-lg border border-red-800/50 bg-red-950/30 p-4">
            <p className="text-sm font-medium text-red-400">Are you sure? This will permanently delete:</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-red-400">
              {Array.from(selectedFeatures).map(f => (
                <li key={f}>{DATA_FEATURES.find(d => d.key === f)?.label}</li>
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
            <p className="mb-2 text-sm font-medium text-green-400">Data deleted successfully:</p>
            <ul className="space-y-1 text-sm text-green-400">
              {Object.entries(deleteResults).map(([feature, result]) => {
                const label = DATA_FEATURES.find(d => d.key === feature)?.label ?? feature;
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
  );
}
