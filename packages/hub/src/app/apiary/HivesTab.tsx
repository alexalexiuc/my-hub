'use client';

import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ApiaryHive, ApiaryYard } from '@my-hub/shared/types';
import { SectionCard } from '@/components/SectionCard';
import { Button, Input, Select, Textarea } from '@/components';
import { apiFetch } from '@/lib/utils';
import { HiveFormSchema, type HiveFormValues, defaultHiveFormValues, formToHiveBody } from './apiary-form.schema';

export function HivesTab() {
  const [hives, setHives] = useState<ApiaryHive[]>([]);
  const [yards, setYards] = useState<ApiaryYard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<HiveFormValues>({
    resolver: zodResolver(HiveFormSchema),
    defaultValues: defaultHiveFormValues,
  });

  const loadData = useCallback(async () => {
    try {
      const [hivesData, yardsData] = await Promise.all([
        apiFetch<{ hives: ApiaryHive[] }>('/api/apiary/hives'),
        apiFetch<{ yards: ApiaryYard[] }>('/api/apiary/yards'),
      ]);
      setHives(hivesData.hives);
      setYards(yardsData.yards);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAdd(values: HiveFormValues) {
    await apiFetch('/api/apiary/hives', { method: 'POST', body: formToHiveBody(values) });
    reset(defaultHiveFormValues);
    setShowForm(false);
    loadData();
  }

  const yardMap = new Map(yards.map(y => [y.id, y.name]));

  const grouped = new Map<string, ApiaryHive[]>();
  for (const hive of hives) {
    const key = hive.yardId ? (yardMap.get(hive.yardId) ?? 'Unknown Yard') : 'Unassigned';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(hive);
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 rounded-xl bg-zinc-800" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Hive'}
        </Button>
      </div>

      {showForm && (
        <SectionCard title="New Hive">
          <form onSubmit={handleSubmit(handleAdd)}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input {...register('name')} placeholder="Hive name *" autoFocus />
              <Select {...register('yardId')} options={yards.map(y => ({ value: y.id, label: y.name }))}>
                <option value="">No yard</option>
              </Select>
              <Input {...register('queenStatus')} placeholder="Queen status" />
              <Input {...register('boxes')} placeholder="Boxes" type="number" />
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

      {hives.length === 0 ? (
        <p className="text-sm text-zinc-500">No hives yet. Add your first hive above.</p>
      ) : (
        Array.from(grouped.entries()).map(([yardName, yardHives]) => (
          <SectionCard key={yardName} title={yardName}>
            <div className="space-y-2">
              {yardHives.map(hive => (
                <div key={hive.id} className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{hive.name}</p>
                    <p className="text-xs text-zinc-500">
                      {[
                        hive.queenStatus && `Queen: ${hive.queenStatus}`,
                        hive.boxes && `${hive.boxes} boxes`,
                        !hive.isActive && 'Inactive',
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'No details'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        ))
      )}
    </div>
  );
}
