'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { CalorieProfile, MealLog, Todo } from '@my-hub/shared/types';
import type { MeasurementWithType } from '@my-hub/shared/services';
import { calculateCalorieTargets } from '@my-hub/shared/utils';
import DashboardHeader from '@/components/dashboard/dashboard-header';
import DashboardFooter from '@/components/dashboard/dashboard-footer';
import TodoWidget from '@/components/dashboard/todo-widget';
import CaloriesWidget from '@/components/dashboard/calories-widget';

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
    description: 'Simple todo list with MCP integration',
    color: 'bg-blue-950/30 border-blue-800/50 hover:border-blue-600/70',
    labelColor: 'text-blue-400',
  },
];

interface Macros {
  protein: number;
  carbs: number;
  fat: number;
}

interface DashboardData {
  userName: string | null;
  todayKcal: number;
  todayTarget: number | null;
  minCalories: number | null;
  maxCalories: number | null;
  macros: Macros;
  todos: Todo[];
}

export default function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0]!;

  const loadData = useCallback(async () => {
    try {
      const [profileRes, mealsRes, todosRes] = await Promise.all([
        fetch('/api/calories/profile'),
        fetch(`/api/calories/meals?date=${today}&limit=200`),
        fetch('/api/todo'),
      ]);

      const [profileData, mealsData, todosData] = await Promise.all([
        profileRes.ok ? profileRes.json() : null,
        mealsRes.ok ? mealsRes.json() : null,
        todosRes.ok ? todosRes.json() : null,
      ]);

      const profile: CalorieProfile | null = profileData?.profile ?? null;
      const measurements: MeasurementWithType[] = profileData?.measurements ?? [];
      const meals: MealLog[] = mealsData?.meals ?? [];
      const todos: Todo[] = todosData?.todos ?? [];

      const todayKcal = meals.reduce((sum: number, m: MealLog) => sum + (m.kcal ?? 0), 0);
      const macros: Macros = {
        protein: Math.round(meals.reduce((sum, m) => sum + (m.protein ?? 0), 0)),
        carbs: Math.round(meals.reduce((sum, m) => sum + (m.carbs ?? 0), 0)),
        fat: Math.round(meals.reduce((sum, m) => sum + (m.fat ?? 0), 0)),
      };
      const latestWeight = measurements.find((m) => m.typeKey === 'weight');

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

      setData({
        userName: profile?.name ?? null,
        todayKcal,
        todayTarget: targets.maxCalories ?? targets.goalCalories ?? targets.tdee ?? null,
        minCalories: targets.minCalories ?? null,
        maxCalories: targets.maxCalories ?? null,
        macros,
        todos,
      });
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAddTodo(title: string) {
    await fetch('/api/todo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    await loadData();
  }

  async function handleMarkDone(id: number) {
    await fetch(`/api/todo/${id}`, { method: 'PATCH' });
    await loadData();
  }

  async function handleMealAdded() {
    await loadData();
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen flex flex-col">
        <DashboardHeader userName={null} />
        <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-8 py-8">
          <div className="space-y-6 animate-pulse">
            <div className="h-4 w-24 bg-zinc-800 rounded" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 h-48" />
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 h-48" />
            </div>
            <div className="h-4 w-16 bg-zinc-800 rounded" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 h-24" />
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 h-24" />
            </div>
          </div>
        </main>
        <DashboardFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader userName={data.userName} />

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-8 py-8 space-y-8">
        {/* Interactive Widgets */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TodoWidget todos={data.todos} loading={false} onAdd={handleAddTodo} onMarkDone={handleMarkDone} />
            <CaloriesWidget
              todayKcal={data.todayKcal}
              todayTarget={data.todayTarget}
              minCalories={data.minCalories}
              maxCalories={data.maxCalories}
              macros={data.macros}
              loading={false}
              onMealAdded={handleMealAdded}
            />
          </div>
        </section>

        {/* App Cards */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">Apps</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {appSections.map(({ href, label, description, color, labelColor }) => (
              <Link key={href} href={href} className={`rounded-xl border p-6 transition ${color}`}>
                <span className={`text-lg font-semibold ${labelColor}`}>{label}</span>
                <p className="text-sm text-zinc-400 mt-1">{description}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Setup */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">Setup</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/mcp-control"
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 shadow-sm hover:bg-zinc-800 hover:border-zinc-700 transition"
            >
              <span className="text-sm font-semibold">MCP Control</span>
              <p className="text-xs text-zinc-500 mt-0.5">Enable or disable MCP servers</p>
            </Link>
          </div>
        </section>
      </main>

      <DashboardFooter />
    </div>
  );
}
