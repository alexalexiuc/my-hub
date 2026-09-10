'use client';

import { useState } from 'react';
import { SectionCard } from '@/components/SectionCard';
import { Button, Card, Checkbox } from '@/components';
import { apiFetch, cn } from '@/lib/utils';

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
        <p className="text-sm text-[var(--muted,#a1a1aa)]">
          Permanently delete your data by feature. This action cannot be undone.
        </p>

        <div className="space-y-2">
          {DATA_FEATURES.map(({ key, label, description }) => {
            const selected = selectedFeatures.has(key);
            return (
              <label key={key} className="block cursor-pointer">
                <Card
                  compact
                  className={cn(
                    'flex items-start gap-3',
                    selected
                      ? 'border-[var(--red,#f87171)]/60 bg-[var(--red-d,rgba(248,113,113,0.1))]'
                      : 'hover:border-[var(--accent)]',
                  )}
                >
                  <Checkbox
                    checked={selected}
                    onChange={() => toggleFeature(key)}
                    className="mt-0.5 accent-[var(--red,#dc2626)]"
                  />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted,#a1a1aa)]">{description}</p>
                  </div>
                </Card>
              </label>
            );
          })}
        </div>

        {selectedFeatures.size > 0 && !deleteConfirm && (
          <Button variant="danger" onClick={() => setDeleteConfirm(true)}>
            Delete selected data…
          </Button>
        )}

        {deleteConfirm && (
          <Card compact className="space-y-3 border-[var(--red,#f87171)]/40 bg-[var(--red-d,rgba(248,113,113,0.1))]">
            <p className="text-sm font-medium text-[var(--red,#f87171)]">Are you sure? This will permanently delete:</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-[var(--red,#f87171)]">
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
          </Card>
        )}

        {deleteResults && (
          <Card compact className="border-[var(--green,#6ee7b7)]/40 bg-[var(--green-d,rgba(110,231,183,0.1))]">
            <p className="mb-2 text-sm font-medium text-[var(--green,#6ee7b7)]">Data deleted successfully:</p>
            <ul className="space-y-1 text-sm text-[var(--green,#6ee7b7)]">
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
          </Card>
        )}
      </div>
    </SectionCard>
  );
}
