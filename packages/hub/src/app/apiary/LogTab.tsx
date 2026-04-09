'use client';

import { useEffect, useState, useCallback } from 'react';
import type { ApiaryLog, ApiaryHive } from '@my-hub/shared/types';
import { SectionCard } from '@/components/SectionCard';
import { Button } from '@/components';
import { apiFetch } from '@/lib/utils';

const LOG_TYPES = ['inspection', 'treatment', 'feeding', 'harvest', 'relocation', 'queen_event', 'note'] as const;

const typeBadgeColors: Record<string, string> = {
  inspection: 'bg-blue-900/50 text-blue-300',
  treatment: 'bg-red-900/50 text-red-300',
  feeding: 'bg-green-900/50 text-green-300',
  harvest: 'bg-amber-900/50 text-amber-300',
  relocation: 'bg-purple-900/50 text-purple-300',
  queen_event: 'bg-pink-900/50 text-pink-300',
  note: 'bg-zinc-700/50 text-zinc-300',
};

export function LogTab() {
  const [logs, setLogs] = useState<ApiaryLog[]>([]);
  const [hives, setHives] = useState<ApiaryHive[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterHive, setFilterHive] = useState('');
  const [filterType, setFilterType] = useState('');

  // Form state
  const [formType, setFormType] = useState<string>('inspection');
  const [formHiveId, setFormHiveId] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formDate, setFormDate] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [logsData, hivesData] = await Promise.all([
        apiFetch<{ logs: ApiaryLog[] }>('/api/apiary/logs', {
          query: { hive_id: filterHive || undefined, type: filterType || undefined },
        }),
        apiFetch<{ hives: ApiaryHive[] }>('/api/apiary/hives'),
      ]);
      setLogs(logsData.logs);
      setHives(hivesData.hives);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filterHive, filterType]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAdd() {
    if (!formType) return;
    const body: Record<string, unknown> = { type: formType };
    if (formHiveId) body.hive_id = Number(formHiveId);
    if (formNotes) body.notes = formNotes;
    if (formDate) body.logged_at = formDate;

    await apiFetch('/api/apiary/logs', { method: 'POST', body });
    setFormType('inspection');
    setFormHiveId('');
    setFormNotes('');
    setFormDate('');
    setShowForm(false);
    loadData();
  }

  async function handleDelete(id: number) {
    await apiFetch(`/api/apiary/logs/${id}`, { method: 'DELETE' });
    loadData();
  }

  const hiveMap = new Map(hives.map((h) => [h.id, h.name]));

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 rounded-xl bg-zinc-800" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-sm"
          value={filterHive}
          onChange={(e) => setFilterHive(e.target.value)}
        >
          <option value="">All hives</option>
          {hives.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-sm"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">All types</option>
          {LOG_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Entry'}
          </Button>
        </div>
      </div>

      {showForm && (
        <SectionCard title="New Log Entry">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm"
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
            >
              {LOG_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm"
              value={formHiveId}
              onChange={(e) => setFormHiveId(e.target.value)}
            >
              <option value="">No hive</option>
              {hives.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
            <input
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm"
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
            />
            <textarea
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm sm:col-span-2"
              placeholder="Notes"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={2}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={handleAdd}>
              Add
            </Button>
          </div>
        </SectionCard>
      )}

      {logs.length === 0 ? (
        <p className="text-sm text-zinc-500">No log entries yet.</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3"
            >
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 mt-0.5 ${typeBadgeColors[log.type] ?? 'bg-zinc-700 text-zinc-300'}`}
              >
                {log.type}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-300">
                  {log.hiveId && (
                    <span className="text-zinc-400">{hiveMap.get(log.hiveId) ?? `Hive #${log.hiveId}`}: </span>
                  )}
                  {log.notes || '—'}
                </p>
                {log.data && typeof log.data === 'object' && Object.keys(log.data as object).length > 0 ? (
                  <pre className="text-xs text-zinc-500 mt-1 overflow-x-auto">{JSON.stringify(log.data, null, 2)}</pre>
                ) : null}
                <p className="text-xs text-zinc-600 mt-1">{new Date(log.loggedAt).toLocaleDateString()}</p>
              </div>
              <button
                onClick={() => handleDelete(log.id)}
                className="text-zinc-600 hover:text-red-400 text-xs shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
