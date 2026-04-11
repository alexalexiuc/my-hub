'use client';

import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { dateToString, calculateMacroKcal } from '@my-hub/shared/utils';
import { SectionCard, Button, Input, Select } from '@/components';
import { apiFetch } from '@/lib/utils';
import { PlusOutlineIcon } from '@/components/icons';
import { MealType, MealTypes, MealTypesValues } from '@my-hub/shared/constants';
import { MEAL_LABEL } from '@/app/calories/constants';

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
  macroGoals: Macros | null;
  loading: boolean;
  onMealAdded: () => void;
}

function MacroBar({
  label,
  value,
  goal,
  sharePct,
  color,
}: {
  label: string;
  value: number;
  goal: number | null;
  sharePct: number;
  color: string;
}) {
  const reached = goal !== null && goal > 0 && value >= goal;
  const barPct = goal !== null && goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : sharePct;
  return (
    <div className="flex-1 text-center">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      {goal !== null && goal > 0 ? (
        <p className="text-sm font-semibold">
          {reached ? (
            <span className="text-green-400">✓</span>
          ) : (
            <>
              {value}
              <span className="text-xs font-normal text-zinc-500">/{goal}g</span>
            </>
          )}
        </p>
      ) : (
        <p className="text-sm font-semibold">{value}g</p>
      )}
      <div className="mt-1 h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
        <div className={`h-full rounded-full ${reached ? 'bg-green-400' : color}`} style={{ width: `${barPct}%` }} />
      </div>
    </div>
  );
}

export function CaloriesWidget({
  todayKcal,
  todayTarget,
  minCalories,
  maxCalories,
  macros,
  macroGoals,
  loading,
  onMealAdded,
}: CaloriesWidgetProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    description: '',
    kcal: '',
    mealType: MealTypes.Lunch as MealType,
  });

  const totalMacroKcal = calculateMacroKcal(macros.protein, macros.carbs, macros.fat);
  const sharePct = (kcal: number) => (totalMacroKcal > 0 ? Math.round((kcal / totalMacroKcal) * 100) : 0);

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

  // When over, show how much the overflow wraps around (capped at one full revolution)
  const overflowAmount = isOver && cap !== null ? Math.min(todayKcal - cap, cap) : 0;
  const overflowData =
    isOver && cap !== null
      ? [
          { value: overflowAmount, key: 'overflow' },
          { value: cap - overflowAmount, key: 'overflow-empty' },
        ]
      : [
          { value: 0, key: 'overflow' },
          { value: 0, key: 'overflow-empty' },
        ];

  async function addMeal() {
    if (!form.description) return;
    setSaving(true);
    try {
      const today = dateToString(new Date());
      await apiFetch('/api/calories/meals', {
        method: 'POST',
        body: {
          description: form.description,
          kcal: form.kcal ? Math.round(Number(form.kcal)) : undefined,
          mealType: form.mealType,
          date: today,
        },
      });
      setShowAdd(false);
      setForm({ description: '', kcal: '', mealType: MealTypes.Lunch });
      onMealAdded();
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      title="Calories"
      className="border-orange-800/50 bg-gradient-to-br from-orange-950/40 to-zinc-900"
      action={
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-300 border border-zinc-700 hover:border-zinc-500 hover:text-white hover:bg-zinc-700/60 transition-all"
          aria-label="Log meal"
          title="Log meal"
        >
          <PlusOutlineIcon className="size-3" />
          Add
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
                {isOver ? (
                  <>
                    {/* Full red background ring — represents hitting the cap */}
                    <Pie
                      data={[{ value: 1, key: 'bg' }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={62}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                      strokeWidth={0}
                      isAnimationActive={false}
                    >
                      <Cell fill="#ef4444" />
                    </Pie>
                    {/* Lighter overlay arc showing how far over the cap we are */}
                    <Pie
                      data={overflowData}
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
                      <Cell key="overflow" fill="#fecaca" />
                      <Cell key="overflow-empty" fill="transparent" />
                    </Pie>
                  </>
                ) : (
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
                )}
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
            <MacroBar
              label="Carbs"
              value={macros.carbs}
              goal={macroGoals?.carbs ?? null}
              sharePct={sharePct(macros.carbs * 4)}
              color="bg-amber-400"
            />
            <MacroBar
              label="Protein"
              value={macros.protein}
              goal={macroGoals?.protein ?? null}
              sharePct={sharePct(macros.protein * 4)}
              color="bg-sky-400"
            />
            <MacroBar
              label="Fat"
              value={macros.fat}
              goal={macroGoals?.fat ?? null}
              sharePct={sharePct(macros.fat * 9)}
              color="bg-rose-400"
            />
          </div>
        </div>
      )}

      {/* Quick-add meal form */}
      {showAdd && (
        <div className="mt-4 border-t border-zinc-700 pt-4 space-y-3">
          <div className="space-y-2">
            <Input
              placeholder="What did you eat?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addMeal()}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-2">
              <Select
                options={MealTypesValues.map((t) => ({ value: t, label: MEAL_LABEL[t] }))}
                value={form.mealType}
                onChange={(e) => setForm({ ...form, mealType: e.target.value as MealType })}
              />
              <Input
                type="number"
                step="1"
                min="0"
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
