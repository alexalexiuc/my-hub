'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '@/lib/utils';
import { Button } from '@/components';
import { PlusOutlineIcon } from '@/components/icons';
import { GetMenuResponseSchema, GetMenusResponseSchema } from '@/app/api/calories/menu/menu.schemas';
import type { GymTime } from '@my-hub/shared/constants';
import { WeekNavigator } from './WeekNavigator';
import { EmptyState } from './EmptyState';
import { MenuDetail } from './MenuDetail';
import { CreateMenuModal } from './CreateMenuModal';
import { toLoggedMeals, nextMenuWeekStart, latestMenu, currentWeekMonday } from './menu.utils';
import type { LoggedMeals } from './menu.utils';
import type { WeeklyMenu, WeeklyMenuSummary } from './types';

export default function WeeklyMenuPage() {
  const [menus, setMenus] = useState<WeeklyMenuSummary[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<WeeklyMenu | null>(null);
  const [loggedMeals, setLoggedMeals] = useState<LoggedMeals>({});
  const [gymDays, setGymDays] = useState<number[]>([]);
  const [dailyTargetKcal, setDailyTargetKcal] = useState<number | null>(null);
  const [gymDayCalorieBonus, setGymDayCalorieBonus] = useState(0);
  const [gymTime, setGymTime] = useState<GymTime | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Stable for the component's lifetime — recomputing on every render would only churn
  // the loadMenus useCallback identity and re-trigger its effect.
  const currentWeekStart = useMemo(() => currentWeekMonday(), []);

  const loadMenus = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/calories/menu', { responseSchema: GetMenusResponseSchema });
      setMenus(data.menus);
      setGymDays(data.gymDays);
      setDailyTargetKcal(data.goalCalories);
      setGymDayCalorieBonus(data.gymDayCalorieBonus);
      setGymTime(data.gymTime);
      const toSelect = data.menus.find(m => m.weekStart === currentWeekStart) ?? latestMenu(data.menus);
      if (toSelect) {
        const detail = await apiFetch(`/api/calories/menu/${toSelect.menuId}`, {
          responseSchema: GetMenuResponseSchema,
        });
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

  async function handleSelect(menu: WeeklyMenuSummary) {
    try {
      const detail = await apiFetch(`/api/calories/menu/${menu.menuId}`, { responseSchema: GetMenuResponseSchema });
      setSelectedMenu(detail.menu);
      setLoggedMeals(toLoggedMeals(detail.loggedDays));
    } catch {
      setError('Failed to load menu details');
    }
  }

  async function handleDelete(menuId: string) {
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

  function handleCreated(createdMenu: WeeklyMenu) {
    const { meals: _meals, ...summary } = createdMenu;
    setMenus(prev => {
      const rest = prev.filter(m => m.weekStart !== createdMenu.weekStart);
      return [summary, ...rest].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    });
    setSelectedMenu(createdMenu);
    setLoggedMeals({});
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-[var(--subtle)]">Loading menus…</div>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Weekly Menu</h1>
          <p className="text-sm text-[var(--subtle)] mt-1">
            Ask Claude to create a weekly menu plan, or build one manually.
          </p>
        </div>
        <Button
          variant="accent"
          size="sm"
          onClick={() => setShowCreateModal(true)}
          className="shrink-0 flex items-center"
        >
          <PlusOutlineIcon className="w-4 h-4 mr-1.5" />
          {/* Once a menu exists this plans a *different* week — "Create" reads like "add something
              here" and sends people looking for the per-day "Add meal" button to the wrong place.
              Shortened on phones: the full phrasing takes 144px of a 375px row and squeezes the
              heading beside it onto two lines. */}
          {menus.length === 0 ? (
            'Create'
          ) : (
            <>
              <span className="hidden sm:inline">Plan another week</span>
              <span className="sm:hidden">Plan week</span>
            </>
          )}
        </Button>
      </div>

      {showCreateModal && (
        <CreateMenuModal
          onClose={() => setShowCreateModal(false)}
          onCreated={menu => void handleCreated(menu)}
          gymDays={gymDays}
          defaultWeekStart={nextMenuWeekStart(menus, currentWeekStart)}
          existingWeekStarts={menus.map(m => m.weekStart)}
          copyFrom={selectedMenu}
        />
      )}

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
              dailyTargetKcal={dailyTargetKcal}
              gymDayCalorieBonus={gymDayCalorieBonus}
              gymTime={gymTime}
              onMetaUpdated={meta => {
                setSelectedMenu(prev => (prev ? { ...prev, ...meta } : prev));
                setMenus(prev => prev.map(m => (m.menuId === selectedMenu.menuId ? { ...m, ...meta } : m)));
              }}
              onMealLogChanged={(day, mealType, logged) =>
                setLoggedMeals(prev => {
                  const key = `${day}:${mealType}`;
                  if (logged) return { ...prev, [key]: true };
                  const { [key]: _removed, ...rest } = prev;
                  return rest;
                })
              }
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
              onMealAdded={(_day, added) =>
                setSelectedMenu(prev => (prev ? { ...prev, meals: [...prev.meals, added] } : prev))
              }
              onMealDeleted={(day, mealType) =>
                setSelectedMenu(prev =>
                  prev
                    ? { ...prev, meals: prev.meals.filter(m => !(m.dayOfWeek === day && m.mealType === mealType)) }
                    : prev,
                )
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
