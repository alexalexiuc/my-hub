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
  {
    href: '/apiary',
    label: 'Apiary',
    description: 'Manage bee yards, hives, inspections & tasks',
    color: 'bg-amber-950/30 border-amber-800/50 hover:border-amber-600/70',
    labelColor: 'text-amber-400',
  },
  {
    href: '/travel',
    label: 'My Travels',
    description: 'Plan trips, track reservations, checklist, companions and documents',
    color: 'bg-emerald-950/30 border-emerald-800/50 hover:border-emerald-600/70',
    labelColor: 'text-emerald-400',
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
  travelFocus: TravelFocus | null;
}

interface BookingRange {
  tripId: number;
  fromAt: string | null;
  toAt: string | null;
}

interface TravelFocus {
  tripId: number;
  name: string;
  destination: string | null;
  color: string;
  status: 'ongoing' | 'upcoming';
  fromAt: string | null;
  toAt: string | null;
}

interface TravelTripsResponse {
  trips: Array<{
    id: number;
    name: string;
    destination: string | null;
    color?: string | null;
    startAt?: string | null;
    endAt?: string | null;
  }>;
  booking_ranges?: BookingRange[];
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateRange(fromAt: string | null, toAt: string | null): string {
  const from = parseDate(fromAt);
  const to = parseDate(toAt);

  if (!from && !to) return 'Dates not set';
  if (from && !to) return from.toLocaleDateString();
  if (!from && to) return to.toLocaleDateString();

  const fromText = from!.toLocaleDateString();
  const toText = to!.toLocaleDateString();
  return fromText === toText ? fromText : `${fromText} -> ${toText}`;
}

function pickTravelFocus(
  trips: Array<{
    id: number;
    name: string;
    destination: string | null;
    color?: string | null;
    startAt?: string | null;
    endAt?: string | null;
  }>,
  bookingRanges: BookingRange[],
): TravelFocus | null {
  const now = new Date();
  const rangeByTripId = new Map<number, BookingRange>(bookingRanges.map((range) => [range.tripId, range]));

  const candidates = trips
    .map((trip) => {
      const range = rangeByTripId.get(trip.id);
      const from = parseDate(range?.fromAt ?? trip.startAt ?? null);
      const to = parseDate(range?.toAt ?? trip.endAt ?? null);

      if (!from) return null;

      if (to && from <= now && now <= to) {
        return {
          tripId: trip.id,
          name: trip.name,
          destination: trip.destination,
          color: trip.color ?? '#3B82F6',
          status: 'ongoing' as const,
          fromAt: range?.fromAt ?? trip.startAt ?? null,
          toAt: range?.toAt ?? trip.endAt ?? null,
          sortKey: to.getTime(),
          priority: 0,
        };
      }

      if (from >= now) {
        return {
          tripId: trip.id,
          name: trip.name,
          destination: trip.destination,
          color: trip.color ?? '#3B82F6',
          status: 'upcoming' as const,
          fromAt: range?.fromAt ?? trip.startAt ?? null,
          toAt: range?.toAt ?? trip.endAt ?? null,
          sortKey: from.getTime(),
          priority: 1,
        };
      }

      return null;
    })
    .filter((trip): trip is NonNullable<typeof trip> => Boolean(trip))
    .sort((a, b) => (a.priority !== b.priority ? a.priority - b.priority : a.sortKey - b.sortKey));

  if (candidates.length === 0) return null;

  const first = candidates[0];
  if (!first) return null;

  return {
    tripId: first.tripId,
    name: first.name,
    destination: first.destination,
    color: first.color,
    status: first.status,
    fromAt: first.fromAt,
    toAt: first.toAt,
  };
}

export default function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0]!;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, mealsRes, todosRes, travelRes] = await Promise.all([
        fetch('/api/calories/profile'),
        fetch(`/api/calories/meals?date=${today}&limit=200`),
        fetch('/api/todo'),
        fetch('/api/travel/trips'),
      ]);

      const [profileData, mealsData, todosData, travelData] = await Promise.all([
        profileRes.ok ? profileRes.json() : null,
        mealsRes.ok ? mealsRes.json() : null,
        todosRes.ok ? todosRes.json() : null,
        travelRes.ok ? (travelRes.json() as Promise<TravelTripsResponse>) : null,
      ]);

      const profile: CalorieProfile | null = profileData?.profile ?? null;
      const measurements: MeasurementWithType[] = profileData?.measurements ?? [];
      const meals: MealLog[] = mealsData?.meals ?? [];
      const todos: Todo[] = todosData?.todos ?? [];
      const travelFocus = travelData ? pickTravelFocus(travelData.trips ?? [], travelData.booking_ranges ?? []) : null;

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
        travelFocus,
      });
    } catch (err) {
      console.error('Failed to load dashboard data', err);
      setData(null);
      setError('Failed to load dashboard data. Please try again.');
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
        {data.travelFocus && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">Travel</h2>
            <Link
              href="/travel"
              className="block rounded-xl border border-zinc-800 bg-zinc-900 p-4 shadow-sm hover:bg-zinc-800 hover:border-zinc-700 transition"
              style={{ borderLeftColor: data.travelFocus.color, borderLeftWidth: '4px' }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: data.travelFocus.color }}
                />
                <span className="text-sm font-semibold text-zinc-100">
                  {data.travelFocus.status === 'ongoing' ? 'Ongoing Trip' : 'Upcoming Trip'}
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-200">{data.travelFocus.name}</p>
              <p className="text-xs text-zinc-400">
                {data.travelFocus.destination ?? 'Destination not set'} ·{' '}
                {formatDateRange(data.travelFocus.fromAt, data.travelFocus.toAt)}
              </p>
            </Link>
          </section>
        )}

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
            <Link
              href="/invites"
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 shadow-sm hover:bg-zinc-800 hover:border-zinc-700 transition"
            >
              <span className="text-sm font-semibold">Invite Links</span>
              <p className="text-xs text-zinc-500 mt-0.5">Invite others to register</p>
            </Link>
          </div>
        </section>
      </main>

      <DashboardFooter />
    </div>
  );
}
