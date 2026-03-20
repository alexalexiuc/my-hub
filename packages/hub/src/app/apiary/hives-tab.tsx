'use client';

import { useEffect, useState, useCallback } from 'react';
import type { ApiaryHive, ApiaryYard } from '@my-hub/shared/types';
import SectionCard from '@/components/section-card';
import Button from '@/components/button';

export default function HivesTab() {
  const [hives, setHives] = useState<ApiaryHive[]>([]);
  const [yards, setYards] = useState<ApiaryYard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formYardId, setFormYardId] = useState('');
  const [formQueenStatus, setFormQueenStatus] = useState('');
  const [formBoxes, setFormBoxes] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const loadData = useCallback(async () => {
    const [hivesRes, yardsRes] = await Promise.all([fetch('/api/apiary/hives'), fetch('/api/apiary/yards')]);
    if (hivesRes.ok) {
      const data = (await hivesRes.json()) as { hives: ApiaryHive[] };
      setHives(data.hives);
    }
    if (yardsRes.ok) {
      const data = (await yardsRes.json()) as { yards: ApiaryYard[] };
      setYards(data.yards);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAdd() {
    if (!formName.trim()) return;
    const body: Record<string, unknown> = { name: formName.trim() };
    if (formYardId) body.yard_id = Number(formYardId);
    if (formQueenStatus) body.queen_status = formQueenStatus;
    if (formBoxes) body.boxes = Number(formBoxes);
    if (formNotes) body.notes = formNotes;

    await fetch('/api/apiary/hives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setFormName('');
    setFormYardId('');
    setFormQueenStatus('');
    setFormBoxes('');
    setFormNotes('');
    setShowForm(false);
    loadData();
  }

  const yardMap = new Map(yards.map((y) => [y.id, y.name]));

  // Group hives by yard
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm"
              placeholder="Hive name *"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
            <select
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm"
              value={formYardId}
              onChange={(e) => setFormYardId(e.target.value)}
            >
              <option value="">No yard</option>
              {yards.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
            <input
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm"
              placeholder="Queen status"
              value={formQueenStatus}
              onChange={(e) => setFormQueenStatus(e.target.value)}
            />
            <input
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm"
              placeholder="Boxes"
              type="number"
              value={formBoxes}
              onChange={(e) => setFormBoxes(e.target.value)}
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
            <Button size="sm" onClick={handleAdd} disabled={!formName.trim()}>
              Add
            </Button>
          </div>
        </SectionCard>
      )}

      {hives.length === 0 ? (
        <p className="text-sm text-zinc-500">No hives yet. Add your first hive above.</p>
      ) : (
        Array.from(grouped.entries()).map(([yardName, yardHives]) => (
          <SectionCard key={yardName} title={yardName}>
            <div className="space-y-2">
              {yardHives.map((hive) => (
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
