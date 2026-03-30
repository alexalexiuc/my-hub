'use client';

import { useEffect, useState } from 'react';
import { SectionCard } from '@/components';

interface Summary {
  yardCount: number;
  hiveCount: number;
  pendingTaskCount: number;
  recentLogs: { id: number; hiveName: string | null; type: string; notes: string | null; loggedAt: string }[];
  upcomingTasks: { id: number; title: string; hiveName: string | null; dueAt: string | null }[];
}

const typeBadgeColors: Record<string, string> = {
  inspection: 'bg-blue-900/50 text-blue-300',
  treatment: 'bg-red-900/50 text-red-300',
  feeding: 'bg-green-900/50 text-green-300',
  harvest: 'bg-amber-900/50 text-amber-300',
  relocation: 'bg-purple-900/50 text-purple-300',
  queen_event: 'bg-pink-900/50 text-pink-300',
  note: 'bg-zinc-700/50 text-zinc-300',
};

export function DashboardTab() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/apiary/summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setSummary(data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-zinc-800" />
          ))}
        </div>
      </div>
    );
  }

  if (!summary) {
    return <p className="text-zinc-500">Failed to load summary.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="Yards" value={summary.yardCount} color="text-green-400" />
        <SummaryCard label="Active Hives" value={summary.hiveCount} color="text-amber-400" />
        <SummaryCard label="Pending Tasks" value={summary.pendingTaskCount} color="text-blue-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent activity */}
        <SectionCard title="Recent Activity">
          {summary.recentLogs.length === 0 ? (
            <p className="text-sm text-zinc-500">No log entries yet.</p>
          ) : (
            <ul className="space-y-2">
              {summary.recentLogs.map((log) => (
                <li key={log.id} className="flex items-start gap-2 text-sm">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${typeBadgeColors[log.type] ?? 'bg-zinc-700 text-zinc-300'}`}
                  >
                    {log.type}
                  </span>
                  <span className="text-zinc-300 truncate">
                    {log.hiveName && <span className="text-zinc-400">{log.hiveName}: </span>}
                    {log.notes || '—'}
                  </span>
                  <span className="text-zinc-600 text-xs shrink-0 ml-auto">
                    {new Date(log.loggedAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Upcoming tasks */}
        <SectionCard title="Upcoming Tasks">
          {summary.upcomingTasks.length === 0 ? (
            <p className="text-sm text-zinc-500">No pending tasks.</p>
          ) : (
            <ul className="space-y-2">
              {summary.upcomingTasks.map((task) => (
                <li key={task.id} className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                  <span className="text-zinc-300 truncate">
                    {task.title}
                    {task.hiveName && <span className="text-zinc-500"> ({task.hiveName})</span>}
                  </span>
                  {task.dueAt && (
                    <span className="text-zinc-600 text-xs shrink-0 ml-auto">
                      {new Date(task.dueAt).toLocaleDateString()}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-zinc-500 mt-1">{label}</p>
    </div>
  );
}
