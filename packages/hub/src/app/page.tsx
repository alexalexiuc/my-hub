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
    color:
      'bg-gradient-to-br from-orange-950/40 to-zinc-900 border-orange-800/50 hover:border-orange-500/70 hover:shadow-lg hover:shadow-orange-950/20 hover:-translate-y-0.5',
    labelColor: 'text-orange-400',
    accentColor: 'bg-orange-500/60',
  },
  {
    href: '/todo',
    label: 'Todo',
    description: 'Simple todo list with MCP integration',
    color:
      'bg-gradient-to-br from-blue-950/40 to-zinc-900 border-blue-800/50 hover:border-blue-500/70 hover:shadow-lg hover:shadow-blue-950/20 hover:-translate-y-0.5',
    labelColor: 'text-blue-400',
    accentColor: 'bg-blue-500/60',
  },
  {
    href: '/apiary',
    label: 'Apiary',
    description: 'Manage bee yards, hives, inspections & tasks',
    color:
      'bg-gradient-to-br from-amber-900/30 to-zinc-900 border-amber-800/50 hover:border-amber-500/70 hover:shadow-lg hover:shadow-amber-900/20 hover:-translate-y-0.5',
    labelColor: 'text-amber-400',
    accentColor: 'bg-amber-500/60',
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
  const [_error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0]!;

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
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
      } catch (err) {
        console.error('Failed to load dashboard data', err);
        setData(null);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [today],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAddTodo(title: string): Promise<number | undefined> {
    const res = await fetch('/api/todo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      const { todo } = await res.json();
      setData((prev) => (prev ? { ...prev, todos: [todo, ...prev.todos] } : prev));
      return todo.id;
    }
  }

  async function handleMarkDone(id: number) {
    await fetch(`/api/todo/${id}`, { method: 'PATCH' });
    setData((prev) => (prev ? { ...prev, todos: prev.todos.filter((t) => t.id !== id) } : prev));
  }

  async function handleDeleteTodo(id: number) {
    await fetch(`/api/todo/${id}`, { method: 'DELETE' });
    setData((prev) => (prev ? { ...prev, todos: prev.todos.filter((t) => t.id !== id) } : prev));
  }

  async function handleMealAdded() {
    await loadData(true);
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
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            <TodoWidget
              todos={data.todos}
              loading={false}
              onAdd={handleAddTodo}
              onMarkDone={handleMarkDone}
              onDelete={handleDeleteTodo}
            />
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
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">Apps</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {appSections.map(({ href, label, description, color, labelColor }) => (
              <Link key={href} href={href} className={`rounded-xl border p-6 transition-all duration-200 ${color}`}>
                <span className={`text-lg font-semibold ${labelColor}`}>{label}</span>
                <p className="text-sm text-zinc-300 mt-1">{description}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Setup */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">Setup</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/mcp-control"
              className="rounded-xl border border-zinc-700/50 bg-gradient-to-br from-zinc-800/50 to-zinc-900 p-4 shadow-sm hover:border-zinc-600 hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-700/60 flex items-center justify-center flex-shrink-0">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-zinc-300"
                  >
                    <rect x="2" y="2" width="20" height="8" rx="2" />
                    <rect x="2" y="14" width="20" height="8" rx="2" />
                    <line x1="6" y1="6" x2="6.01" y2="6" />
                    <line x1="6" y1="18" x2="6.01" y2="18" />
                  </svg>
                </div>
                <div>
                  <span className="text-sm font-semibold text-zinc-200">MCP Control</span>
                  <p className="text-xs text-zinc-400 mt-0.5">Enable or disable MCP servers</p>
                </div>
              </div>
            </Link>
            <Link
              href="/invites"
              className="rounded-xl border border-zinc-700/50 bg-gradient-to-br from-zinc-800/50 to-zinc-900 p-4 shadow-sm hover:border-zinc-600 hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-700/60 flex items-center justify-center flex-shrink-0">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-zinc-300"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                </div>
                <div>
                  <span className="text-sm font-semibold text-zinc-200">Invite Links</span>
                  <p className="text-xs text-zinc-400 mt-0.5">Invite others to register</p>
                </div>
              </div>
            </Link>
          </div>
        </section>
      </main>

      <DashboardFooter />
    </div>
  );
}
