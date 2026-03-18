'use client';

import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import SectionCard from '@/components/section-card';
import Button from '@/components/button';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
type MealType = (typeof MEAL_TYPES)[number];

const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

interface Macros {
  protein: number;
  carbs: number;
  fat: number;
}

interface CaloriesWidgetProps {
  todayKcal: number;
  todayTarget: number | null;
  minCalories: number | null;
  maxCalories: number | null;
  macros: Macros;
  loading: boolean;
  onMealAdded: () => void;
}

function MacroBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex-1 text-center">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-sm font-semibold">{value}g</p>
      <div className="mt-1 h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value > 0 ? 100 : 0, 100)}%` }} />
      </div>
    </div>
  );
}

export default function CaloriesWidget({
  todayKcal,
  todayTarget,
  minCalories,
  maxCalories,
  macros,
  loading,
  onMealAdded,
}: CaloriesWidgetProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    description: '',
    kcal: '',
    mealType: 'lunch' as MealType,
  });

  const cap = maxCalories ?? todayTarget;
  const isOver = cap !== null && todayKcal > cap;
  const isUnder = minCalories !== null && todayKcal < minCalories;
  const remaining = cap !== null ? Math.max(cap - todayKcal, 0) : null;

  const eaten = todayKcal;
  const chartData =
    cap !== null
      ? isOver
        ? [{ value: cap, key: 'eaten' }]
        : [
            { value: eaten, key: 'eaten' },
            { value: remaining!, key: 'remaining' },
          ]
      : [{ value: 1, key: 'empty' }];

  const arcColor = cap !== null ? (isOver ? '#ef4444' : isUnder ? '#facc15' : '#4ade80') : '#3f3f46';

  async function addMeal() {
    if (!form.description) return;
    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await fetch('/api/calories/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: form.description,
          kcal: form.kcal ? Number(form.kcal) : undefined,
          mealType: form.mealType,
          date: today,
        }),
      });
      setShowAdd(false);
      setForm({ description: '', kcal: '', mealType: 'lunch' });
      onMealAdded();
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      title="Calories"
      className="border-orange-800/50 bg-orange-950/20"
      action={
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition"
          aria-label="Log meal"
          title="Log meal"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      }
    >
      {loading ? (
        <div className="text-sm text-zinc-500 animate-pulse">Loading...</div>
      ) : (
        <div className="flex flex-col items-center">
          {/* Donut chart */}
          <div className="relative w-[140px] h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={62}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  strokeWidth={0}
                  animationDuration={800}
                >
                  {chartData.map((entry, i) => (
                    <Cell key={entry.key} fill={i === 0 ? arcColor : '#27272a'} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-xl font-bold ${isOver ? 'text-red-400' : isUnder ? 'text-yellow-400' : ''}`}>
                {cap !== null ? (isOver ? `+${todayKcal - cap}` : remaining) : eaten}
              </span>
              <span className="text-[10px] text-zinc-500">
                {cap !== null ? (isOver ? 'Over' : 'Remaining') : 'kcal'}
              </span>
            </div>
          </div>
          {/* Eaten / Target line */}
          <p className="text-sm text-zinc-400">
            <span className="font-semibold text-zinc-200">{eaten}</span>
            {cap !== null && (
              <>
                {' '}
                <span className="text-zinc-600">/</span> <span>{cap}</span>
              </>
            )}{' '}
            kcal
          </p>
          {(minCalories !== null || cap !== null) && (
            <p className={`text-xs mt-1 ${isOver ? 'text-red-400' : isUnder ? 'text-yellow-400' : 'text-zinc-500'}`}>
              {minCalories !== null && cap !== null
                ? `Target range: ${minCalories}-${cap} kcal`
                : minCalories !== null
                  ? `Minimum target: ${minCalories} kcal`
                  : `Target: ${cap} kcal`}
            </p>
          )}

          {/* Macro bars */}
          <div className="flex gap-4 w-full mt-4 pt-3 border-t border-zinc-800">
            <MacroBar label="Carbs" value={macros.carbs} color="bg-amber-400" />
            <MacroBar label="Protein" value={macros.protein} color="bg-sky-400" />
            <MacroBar label="Fat" value={macros.fat} color="bg-rose-400" />
          </div>
        </div>
      )}

      {/* Quick-add meal form */}
      {showAdd && (
        <div className="mt-4 border-t border-zinc-700 pt-4 space-y-3">
          <div className="space-y-2">
            <input
              className="input"
              placeholder="What did you eat?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addMeal()}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                className="input"
                value={form.mealType}
                onChange={(e) => setForm({ ...form, mealType: e.target.value as MealType })}
              >
                {MEAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {MEAL_LABEL[t]}
                  </option>
                ))}
              </select>
              <input
                className="input"
                type="number"
                placeholder="kcal"
                value={form.kcal}
                onChange={(e) => setForm({ ...form, kcal: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={addMeal} loading={saving} disabled={!form.description}>
              Add
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
