'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { CalorieProfile, MealLog } from '@my-hub/shared/types';
import type { MeasurementWithType } from '@my-hub/shared/services';
import { calculateCalorieTargets } from '@my-hub/shared/utils';

interface QuickStats {
  todayKcal: number;
  todayTarget: number | null;
  latestWeight: MeasurementWithType | null;
}

const appSections = [
  {
    href: '/calories',
    label: 'Calories',
    description: 'Track meals, body measurements & nutrition goals',
    color: 'bg-orange-950/30 border-orange-800/50 hover:border-orange-600/70',
    labelColor: 'text-orange-400',
  },
  {
    href: '/todo',
    label: 'Todo',
    description: 'Simple todo list for testing MCP integration',
    color: 'bg-blue-950/30 border-blue-800/50 hover:border-blue-600/70',
    labelColor: 'text-blue-400',
  },
];

const adminSections = [
  { href: '/oauth-clients', label: 'OAuth Clients', description: 'Manage MCP API credentials' },
  { href: '/mcp-control', label: 'MCP Control', description: 'Enable or disable MCP servers' },
  { href: '/data-explorer', label: 'Data Explorer', description: 'Browse and edit raw records' },
];

export default function HomePage() {
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/calories/profile').then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/calories/meals?date=${new Date().toISOString().split('T')[0]}&limit=200`).then((r) =>
        r.ok ? r.json() : null,
      ),
    ]).then(([profileData, mealsData]) => {
      if (!profileData || !mealsData) return;
      const profile: CalorieProfile | null = profileData.profile;
      const measurements: MeasurementWithType[] = profileData.measurements ?? [];
      const meals: MealLog[] = mealsData.meals ?? [];
      const todayKcal = meals.reduce((sum: number, m: MealLog) => sum + (m.kcal ?? 0), 0);
      const latestWeight = measurements.find((m) => m.typeKey === 'weight') ?? null;

      const targets = calculateCalorieTargets({
        age: profile?.age ?? null,
        sex: profile?.sex ?? null,
        heightCm: profile?.heightCm ?? null,
        weightKg: latestWeight?.value ?? null,
        activityLevel: profile?.activityLevel ?? null,
        goalType: profile?.goalType ?? null,
        goalWeeklyRateKg: profile?.goalWeeklyRateKg ?? null,
        goalMinCalories: profile?.goalMinCalories ?? null,
        goalMaxCalories: profile?.goalMaxCalories ?? null,
      });
      const todayTarget = targets.maxCalories ?? targets.goalCalories ?? targets.tdee;

      setUserName(profile?.name ?? null);
      setStats({ todayKcal, todayTarget, latestWeight });
    });
  }, []);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">my-hub</h1>
          {userName && <p className="text-zinc-400 mt-1">Welcome, {userName}</p>}
        </div>
        <Link
          href="/profile"
          className="text-sm text-zinc-300 hover:text-zinc-100 border border-zinc-800 rounded-lg px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 transition"
        >
          Profile
        </Link>
      </div>

      {/* Quick stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard
            label="Today's calories"
            value={`${stats.todayKcal}`}
            sub={stats.todayTarget ? `/ ${stats.todayTarget} kcal` : undefined}
            accent={stats.todayTarget ? (stats.todayKcal >= stats.todayTarget ? 'green' : 'blue') : 'neutral'}
          />
          <StatCard
            label="Weight"
            value={stats.latestWeight ? `${stats.latestWeight.value}` : '—'}
            sub={stats.latestWeight ? `kg · ${stats.latestWeight.date}` : undefined}
            accent="neutral"
          />
          <StatCard
            label="Daily target"
            value={stats.todayTarget ? `${stats.todayTarget}` : '—'}
            sub={stats.todayTarget ? 'kcal' : 'not set'}
            accent="neutral"
          />
        </div>
      )}

      {/* App sections */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">Apps</h2>
        <div className="grid grid-cols-2 gap-4">
          {appSections.map(({ href, label, description, color, labelColor }) => (
            <Link key={href} href={href} className={`rounded-xl border p-6 transition ${color}`}>
              <span className={`text-lg font-semibold ${labelColor}`}>{label}</span>
              <p className="text-sm text-zinc-400 mt-1">{description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Admin section */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">Admin</h2>
        <div className="grid grid-cols-3 gap-3">
          {adminSections.map(({ href, label, description }) => (
            <Link
              key={href}
              href={href}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 shadow-sm hover:bg-zinc-800 hover:border-zinc-700 transition"
            >
              <span className="text-sm font-semibold">{label}</span>
              <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: 'blue' | 'green' | 'neutral';
}) {
  const accentCls = {
    blue: 'text-indigo-400',
    green: 'text-emerald-400',
    neutral: 'text-zinc-100',
  }[accent];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 shadow-sm">
      <p className="text-xs text-zinc-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accentCls}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  );
}
