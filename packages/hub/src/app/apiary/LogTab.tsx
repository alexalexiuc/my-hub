'use client';

import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ApiaryLog, ApiaryHive } from '@my-hub/shared/types';
import { ApiaryLogTypes } from '@my-hub/shared/schemas';
import { SectionCard } from '@/components/SectionCard';
import { Button, Input, Select, Textarea } from '@/components';
import { apiFetch } from '@/lib/utils';
import { LogFormSchema, type LogFormValues, defaultLogFormValues, formToLogBody } from './apiary-form.schema';

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

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<LogFormValues>({
    resolver: zodResolver(LogFormSchema),
    defaultValues: defaultLogFormValues,
  });

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

  async function handleAdd(values: LogFormValues) {
    await apiFetch('/api/apiary/logs', { method: 'POST', body: formToLogBody(values) });
    reset(defaultLogFormValues);
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
        <Select
          className="w-auto"
          options={hives.map((h) => ({ value: h.id, label: h.name }))}
          value={filterHive}
          onChange={(e) => setFilterHive(e.target.value)}
        >
          <option value="">All hives</option>
        </Select>
        <Select
          className="w-auto"
          options={ApiaryLogTypes.map((t: string) => ({ value: t, label: t }))}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">All types</option>
        </Select>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Entry'}
          </Button>
        </div>
      </div>

      {showForm && (
        <SectionCard title="New Log Entry">
          <form onSubmit={handleSubmit(handleAdd)}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select {...register('type')} options={ApiaryLogTypes.map((t: string) => ({ value: t, label: t }))} />
              <Select {...register('hiveId')} options={hives.map((h) => ({ value: h.id, label: h.name }))}>
                <option value="">No hive</option>
              </Select>
              <Input {...register('loggedAt')} type="date" />
              <Textarea {...register('notes')} className="sm:col-span-2" placeholder="Notes" rows={2} />
            </div>
            <div className="mt-3 flex justify-end">
              <Button type="submit" size="sm" loading={isSubmitting}>
                Add
              </Button>
            </div>
          </form>
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
