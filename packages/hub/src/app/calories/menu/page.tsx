'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/utils';
import { DAY_LABELS } from '@my-hub/shared/constants';
import { dateToString, startOfWeekMonday } from '@my-hub/shared/utils';
import type { DayOfWeek } from '@my-hub/shared/constants';
import type { MealType } from '@my-hub/shared/constants';
import { ShoppingListModal } from './ShoppingListModal';
import { SwapMealModal } from './SwapMealModal';
import { DAYS, MEAL_ORDER, MEAL_LABELS, dateForDay, toLoggedMeals } from './menu.utils';
import type { LoggedMeals } from './menu.utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WeeklyMenuMeal {
  id: number;
  menuId: string;
  dayOfWeek: DayOfWeek;
  mealType: MealType;
  description: string;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

interface WeeklyMenu {
  id: number;
  menuId: string;
  weekStart: string;
  title: string | null;
  notes: string | null;
  createdAt: string;
  meals: WeeklyMenuMeal[];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WeeklyMenuPage() {
  const [menus, setMenus] = useState<WeeklyMenu[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<WeeklyMenu | null>(null);
  const [loggedMeals, setLoggedMeals] = useState<LoggedMeals>({});
  const [gymDays, setGymDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const currentWeekStart = dateToString(startOfWeekMonday(new Date()));

  const loadMenus = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch<{ menus: WeeklyMenu[]; gymDays: number[] }>('/api/calories/menu');
      setMenus(data.menus);
      setGymDays(data.gymDays ?? []);
      const current = data.menus.find(m => m.weekStart === currentWeekStart);
      if (current) {
        const detail = await apiFetch<{ menu: WeeklyMenu; loggedDays: Record<string, string> }>(
          `/api/calories/menu/${current.menuId}`,
        );
        setSelectedMenu(detail.menu);
        setLoggedMeals(toLoggedMeals(detail.loggedDays));
      } else {
        setSelectedMenu(null);
        setLoggedMeals({});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load menus');
    } finally {
      setLoading(false);
    }
  }, [currentWeekStart]);

  useEffect(() => {
    void loadMenus();
  }, [loadMenus]);

  async function handleSelect(menu: WeeklyMenu) {
    try {
      const detail = await apiFetch<{ menu: WeeklyMenu; loggedDays: Record<string, string> }>(
        `/api/calories/menu/${menu.menuId}`,
      );
      setSelectedMenu(detail.menu);
      setLoggedMeals(toLoggedMeals(detail.loggedDays));
    } catch {
      setError('Failed to load menu details');
    }
  }

  async function handleDelete(menuId: string) {
    if (!confirm('Delete this weekly menu?')) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/calories/menu/${menuId}`, { method: 'DELETE' });
      await loadMenus();
    } catch {
      setError('Failed to delete menu');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-[var(--subtle)]">Loading menus…</div>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--text)]">Weekly Menu</h1>
        <p className="text-sm text-[var(--subtle)] mt-1">
          Ask Claude to create a weekly menu plan — it will appear here automatically.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {menus.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-6">
          <WeekNavigator menus={menus} selectedMenu={selectedMenu} onSelect={handleSelect} />

          {selectedMenu && (
            <MenuDetail
              menu={selectedMenu}
              loggedMeals={loggedMeals}
              gymDays={gymDays}
              onMealLogged={(day, mealType) => setLoggedMeals(prev => ({ ...prev, [`${day}:${mealType}`]: true }))}
              onMealSwapped={(day, updated) =>
                setSelectedMenu(prev =>
                  prev
                    ? {
                        ...prev,
                        meals: prev.meals.map(m =>
                          m.dayOfWeek === day && m.mealType === updated.mealType ? { ...m, ...updated } : m,
                        ),
                      }
                    : prev,
                )
              }
              onMealAdded={(day, added) =>
                setSelectedMenu(prev => (prev ? { ...prev, meals: [...prev.meals, added] } : prev))
              }
              onDelete={handleDelete}
              deleting={deleting}
              isCurrentWeek={selectedMenu.weekStart === currentWeekStart}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function WeekNavigator({
  menus,
  selectedMenu,
  onSelect,
}: {
  menus: WeeklyMenu[];
  selectedMenu: WeeklyMenu | null;
  onSelect: (menu: WeeklyMenu) => void;
}) {
  const idx = menus.findIndex(m => m.menuId === selectedMenu?.menuId);
  const canPrev = idx < menus.length - 1;
  const canNext = idx > 0;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => canPrev && onSelect(menus[idx + 1]!)}
        disabled={!canPrev}
        className="rounded-lg border border-[var(--border)] bg-[var(--card2)] px-2.5 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--card)] disabled:opacity-30 disabled:cursor-not-allowed transition"
        title="Previous week"
      >
        ‹
      </button>

      <span className="text-sm font-medium text-[var(--text)] min-w-[160px] text-center">
        {selectedMenu ? formatWeekLabel(selectedMenu.weekStart) : '—'}
      </span>

      <button
        onClick={() => canNext && onSelect(menus[idx - 1]!)}
        disabled={!canNext}
        className="rounded-lg border border-[var(--border)] bg-[var(--card2)] px-2.5 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--card)] disabled:opacity-30 disabled:cursor-not-allowed transition"
        title="Next week"
      >
        ›
      </button>

      <span className="text-xs text-[var(--subtle)] ml-1">
        {idx + 1} / {menus.length}
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-[var(--border)] p-12 text-center">
      <span className="text-4xl">🗓️</span>
      <div>
        <p className="font-semibold text-[var(--text)]">No weekly menus yet</p>
        <p className="mt-1 text-sm text-[var(--subtle)]">
          Ask Claude: <span className="italic">"Plan my meals for next week"</span> and it will create a menu here.
        </p>
      </div>
    </div>
  );
}

function MenuDetail({
  menu,
  loggedMeals,
  gymDays,
  onMealLogged,
  onMealSwapped,
  onMealAdded,
  onDelete,
  deleting,
  isCurrentWeek,
}: {
  menu: WeeklyMenu;
  loggedMeals: LoggedMeals;
  gymDays: number[];
  onMealLogged: (day: DayOfWeek, mealType: MealType) => void;
  onMealSwapped: (day: DayOfWeek, updated: WeeklyMenuMeal) => void;
  onMealAdded: (day: DayOfWeek, added: WeeklyMenuMeal) => void;
  onDelete: (menuId: string) => void;
  deleting: boolean;
  isCurrentWeek: boolean;
}) {
  const [showShoppingList, setShowShoppingList] = useState(false);
  const byDay = menu.meals.reduce<Record<number, WeeklyMenuMeal[]>>((acc, meal) => {
    (acc[meal.dayOfWeek] ??= []).push(meal);
    return acc;
  }, {});
  const today = dateToString();

  // Adherence summary: past/today days that have meals planned
  const pastDaysWithMeals = DAYS.filter(d => {
    const dd = dateForDay(menu.weekStart, d);
    return dd <= today && (byDay[d]?.length ?? 0) > 0;
  });
  const fullyLoggedDays = pastDaysWithMeals.filter(d => {
    const dayMeals = byDay[d] ?? [];
    return dayMeals.length > 0 && dayMeals.every(m => `${d}:${m.mealType}` in loggedMeals);
  });
  // Bar uses partial-day credit: each day contributes loggedMeals/plannedMeals to the fill
  const adherencePct =
    pastDaysWithMeals.length > 0
      ? Math.round(
          (pastDaysWithMeals.reduce<number>((sum, d) => {
            const dayMeals = byDay[d] ?? [];
            const logged = dayMeals.filter(m => `${d}:${m.mealType}` in loggedMeals).length;
            return sum + (dayMeals.length > 0 ? logged / dayMeals.length : 0);
          }, 0) /
            pastDaysWithMeals.length) *
            100,
        )
      : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">
            {menu.title ?? formatWeekLabel(menu.weekStart)}
            {isCurrentWeek && (
              <span className="ml-2 rounded-full bg-[var(--accent)]/20 px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                This week
              </span>
            )}
          </h2>
          {menu.notes && <p className="text-sm text-[var(--subtle)] mt-0.5">{menu.notes}</p>}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowShoppingList(true)}
            className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition"
          >
            🛒 Shopping list
          </button>
          <button
            onClick={() => onDelete(menu.menuId)}
            disabled={deleting}
            className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition"
          >
            Delete
          </button>
        </div>
      </div>

      {showShoppingList && (
        <ShoppingListModal
          meals={menu.meals}
          weekLabel={formatWeekLabel(menu.weekStart)}
          onClose={() => setShowShoppingList(false)}
        />
      )}

      {pastDaysWithMeals.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2">
          <span className="text-xs text-[var(--muted)] shrink-0">Adherence</span>
          <div className="flex-1 h-1.5 rounded-full bg-[var(--card3)]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                adherencePct === 100 ? 'bg-green-400' : 'bg-[var(--accent)]'
              }`}
              style={{ width: `${adherencePct}%` }}
            />
          </div>
          <span
            className={`text-xs font-semibold shrink-0 ${
              adherencePct === 100 ? 'text-green-400' : 'text-[var(--text)]'
            }`}
          >
            {fullyLoggedDays.length}/{pastDaysWithMeals.length} days
          </span>
        </div>
      )}

      <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-3 md:grid md:grid-cols-2 md:overflow-x-visible md:pb-0 lg:grid-cols-3 xl:grid-cols-4">
        {DAYS.map(day => (
          <DayCard
            key={day}
            day={day}
            meals={byDay[day] ?? []}
            menuId={menu.menuId}
            weekStart={menu.weekStart}
            isCurrentWeek={isCurrentWeek}
            today={today}
            loggedMeals={loggedMeals}
            isGymDay={gymDays.includes(day)}
            onMealLogged={mealType => onMealLogged(day, mealType)}
            onMealSwapped={onMealSwapped}
            onMealAdded={onMealAdded}
          />
        ))}
      </div>
    </div>
  );
}

function DayCard({
  day,
  meals,
  menuId,
  weekStart,
  isCurrentWeek,
  today,
  loggedMeals,
  isGymDay,
  onMealLogged,
  onMealSwapped,
  onMealAdded,
}: {
  day: DayOfWeek;
  meals: WeeklyMenuMeal[];
  menuId: string;
  weekStart: string;
  isCurrentWeek: boolean;
  today: string;
  loggedMeals: LoggedMeals;
  isGymDay: boolean;
  onMealLogged: (mealType: MealType) => void;
  onMealSwapped: (day: DayOfWeek, updated: WeeklyMenuMeal) => void;
  onMealAdded: (day: DayOfWeek, added: WeeklyMenuMeal) => void;
}) {
  const [loggingAll, setLoggingAll] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addMealType, setAddMealType] = useState<MealType>('snack');
  const [addDescription, setAddDescription] = useState('');
  const [addKcal, setAddKcal] = useState('');
  const [adding, setAdding] = useState(false);

  const dayKcal = meals.reduce((s, m) => s + (m.kcal ?? 0), 0);
  const dayDate = dateForDay(weekStart, day);
  const isToday = isCurrentWeek && dayDate === today;
  const isFuture = dayDate > today;

  const plannedTypes = new Set(meals.map(m => m.mealType));
  const availableTypes = MEAL_ORDER.filter(mt => !plannedTypes.has(mt));

  async function handleAddMeal() {
    if (!addDescription.trim() || !addMealType) return;
    setAdding(true);
    try {
      const data = await apiFetch<{ meal: WeeklyMenuMeal }>(`/api/calories/menu/${menuId}/meals`, {
        method: 'POST',
        body: {
          dayOfWeek: day,
          mealType: addMealType,
          description: addDescription.trim(),
          kcal: addKcal ? parseInt(addKcal, 10) : undefined,
        },
      });
      onMealAdded(day, data.meal);
      setShowAddForm(false);
      setAddDescription('');
      setAddKcal('');
    } finally {
      setAdding(false);
    }
  }

  const mealByType = new Map(meals.map(m => [m.mealType, m]));
  const unloggedMeals = MEAL_ORDER.flatMap(mt => {
    const meal = mealByType.get(mt);
    return meal && !(`${day}:${mt}` in loggedMeals) ? [meal] : [];
  });

  const allLogged = unloggedMeals.length === 0 && meals.length > 0;
  const loggedCount = meals.length - unloggedMeals.length;

  async function handleLogAll() {
    setLoggingAll(true);
    try {
      await Promise.all(
        unloggedMeals.map(m =>
          Promise.all([
            apiFetch('/api/calories/meals', {
              method: 'POST',
              body: {
                description: m.description,
                mealType: m.mealType,
                date: dayDate,
                kcal: m.kcal ?? undefined,
                protein: m.protein ?? undefined,
                carbs: m.carbs ?? undefined,
                fat: m.fat ?? undefined,
              },
            }),
            apiFetch(`/api/calories/menu/${menuId}/log-day`, {
              method: 'POST',
              body: { dayOfWeek: day, loggedDate: dayDate, mealType: m.mealType },
            }),
          ]).then(() => onMealLogged(m.mealType)),
        ),
      );
    } finally {
      setLoggingAll(false);
    }
  }

  return (
    <div
      className={`snap-start shrink-0 w-[88vw] md:w-auto rounded-xl border p-4 flex flex-col gap-3 ${
        isToday
          ? 'border-green-500/60 bg-green-500/5'
          : isFuture
            ? 'border-[var(--border)] bg-[var(--card2)] opacity-50'
            : 'border-[var(--border)] bg-[var(--card2)]'
      }`}
    >
      {/* Day header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-[var(--text)]">{DAY_LABELS[day]}</span>
          {isToday && (
            <span className="rounded-full bg-[var(--accent)]/20 px-1.5 py-0.5 text-[9px] font-medium text-[var(--accent)] uppercase tracking-wide">
              Today
            </span>
          )}
          {isGymDay && <span title="Gym day">💪</span>}
          {!isFuture && !allLogged && meals.length > 0 && (
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--card3)] text-[var(--muted)]">
              {loggedCount}/{meals.length}
            </span>
          )}
        </div>
        {dayKcal > 0 && <span className="text-xs font-medium text-[var(--accent)]">{dayKcal} kcal</span>}
      </div>

      {/* Meals */}
      {meals.length === 0 ? (
        <p className="text-xs text-[var(--subtle)] italic">No meals planned</p>
      ) : (
        <div className="flex flex-col gap-2 flex-1">
          {MEAL_ORDER.flatMap(mt => {
            const meal = mealByType.get(mt);
            if (!meal) return [];
            const logged = `${day}:${mt}` in loggedMeals;
            return (
              <MealRow
                key={mt}
                meal={meal}
                menuId={menuId}
                dayOfWeek={day}
                dayDate={dayDate}
                logged={logged}
                isFuture={isFuture}
                onLogged={() => onMealLogged(mt)}
                onSwapped={updated => onMealSwapped(day, updated)}
              />
            );
          })}
        </div>
      )}

      {/* Add meal inline form */}
      {availableTypes.length > 0 &&
        (showAddForm ? (
          <div className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2.5">
            <div className="flex gap-1.5">
              <select
                value={addMealType}
                onChange={e => setAddMealType(e.target.value as MealType)}
                className="rounded border border-[var(--border)] bg-[var(--card2)] px-2 py-1 text-[10px] text-[var(--text)] focus:outline-none"
              >
                {availableTypes.map(mt => (
                  <option key={mt} value={mt}>
                    {MEAL_LABELS[mt]}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={addKcal}
                onChange={e => setAddKcal(e.target.value)}
                placeholder="kcal"
                className="w-16 rounded border border-[var(--border)] bg-[var(--card2)] px-2 py-1 text-[10px] text-[var(--text)] placeholder:text-[var(--subtle)] focus:outline-none"
              />
            </div>
            <input
              type="text"
              value={addDescription}
              onChange={e => setAddDescription(e.target.value)}
              placeholder="What will you eat?"
              className="rounded border border-[var(--border)] bg-[var(--card2)] px-2 py-1 text-xs text-[var(--text)] placeholder:text-[var(--subtle)] focus:outline-none"
            />
            <div className="flex gap-1.5">
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setAddDescription('');
                  setAddKcal('');
                }}
                className="flex-1 rounded border border-[var(--border)] py-1 text-[10px] text-[var(--muted)] hover:text-[var(--text)] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMeal}
                disabled={!addDescription.trim() || adding}
                className="flex-1 rounded bg-[var(--accent)]/10 border border-[var(--accent)]/30 py-1 text-[10px] font-medium text-[var(--accent)] hover:bg-[var(--accent)]/20 disabled:opacity-40 transition"
              >
                {adding ? '…' : 'Add'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setAddMealType(availableTypes[0]!);
              setShowAddForm(true);
            }}
            className="w-full rounded-lg border border-dashed border-[var(--border)] py-1.5 text-[10px] text-[var(--muted)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)] transition"
          >
            + Add meal
          </button>
        ))}

      {/* Log all button */}
      {meals.length > 0 && (
        <div className="mt-auto border-t border-[var(--border)] pt-2 h-10 flex items-center justify-center">
          {allLogged ? (
            <p className="text-xs text-green-400 font-medium text-center">✓ Full day logged</p>
          ) : isFuture ? null : (
            <button
              onClick={handleLogAll}
              disabled={loggingAll}
              className="w-full rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/30 px-3 py-2 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent)]/20 disabled:opacity-40 transition"
            >
              {loggingAll ? 'Logging…' : 'Log full day ✓'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MealRow({
  meal,
  menuId,
  dayOfWeek,
  dayDate,
  logged,
  isFuture,
  onLogged,
  onSwapped,
}: {
  meal: WeeklyMenuMeal;
  menuId: string;
  dayOfWeek: DayOfWeek;
  dayDate: string;
  logged: boolean;
  isFuture: boolean;
  onLogged: () => void;
  onSwapped: (updated: WeeklyMenuMeal) => void;
}) {
  const [logging, setLogging] = useState(false);
  const [error, setError] = useState(false);
  const [showSwap, setShowSwap] = useState(false);

  async function handleLog() {
    setLogging(true);
    setError(false);
    try {
      await apiFetch('/api/calories/meals', {
        method: 'POST',
        body: {
          description: meal.description,
          mealType: meal.mealType,
          date: dayDate,
          kcal: meal.kcal ?? undefined,
          protein: meal.protein ?? undefined,
          carbs: meal.carbs ?? undefined,
          fat: meal.fat ?? undefined,
        },
      });
      await apiFetch(`/api/calories/menu/${menuId}/log-day`, {
        method: 'POST',
        body: { dayOfWeek, loggedDate: dayDate, mealType: meal.mealType },
      });
      onLogged();
    } catch {
      setError(true);
    } finally {
      setLogging(false);
    }
  }

  return (
    <>
      <div
        className={`rounded-lg p-2.5 flex flex-col gap-1 ${
          logged ? 'bg-green-500/5 border border-green-500/20' : 'bg-[var(--card)] border border-[var(--border)]'
        }`}
      >
        {/* Meal type + buttons on same row */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wide font-semibold text-[var(--muted)]">
            {MEAL_LABELS[meal.mealType]}
          </span>
          <div className="flex items-center gap-1">
            {!logged && (
              <button
                onClick={() => setShowSwap(true)}
                title="Edit this meal"
                className="shrink-0 rounded px-2 py-0.5 text-[10px] font-medium border border-[var(--border)] text-[var(--subtle)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)] transition"
              >
                ✎ Edit
              </button>
            )}
            {!isFuture && (
              <button
                onClick={handleLog}
                disabled={logged || logging}
                title={logged ? 'Already logged' : 'Log this meal'}
                className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-medium border transition ${
                  logged
                    ? 'border-green-500/30 bg-green-500/10 text-green-400 cursor-default'
                    : error
                      ? 'border-red-500/30 bg-red-500/10 text-red-400'
                      : 'border-[var(--border)] text-[var(--subtle)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)] disabled:opacity-40'
                }`}
              >
                {logged ? '✓ Logged' : logging ? '…' : 'Log'}
              </button>
            )}
          </div>
        </div>
        {/* Description + macros below */}
        <span className="text-xs text-[var(--text)] leading-snug">{meal.description}</span>
        {meal.kcal != null && (
          <span className="text-[10px] text-[var(--subtle)]">
            {meal.kcal} kcal
            {meal.protein != null && ` · P ${meal.protein}g`}
            {meal.carbs != null && ` · C ${meal.carbs}g`}
            {meal.fat != null && ` · F ${meal.fat}g`}
          </span>
        )}
      </div>

      {showSwap && (
        <SwapMealModal
          meal={meal}
          menuId={menuId}
          dayOfWeek={dayOfWeek}
          dayDate={dayDate}
          onClose={() => setShowSwap(false)}
          onSwapped={updated => {
            onSwapped(updated);
          }}
        />
      )}
    </>
  );
}

function formatWeekLabel(weekStart: string): string {
  const date = new Date(weekStart + 'T00:00:00');
  const end = new Date(date);
  end.setDate(date.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(date)} – ${fmt(end)}`;
}
