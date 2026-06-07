'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/utils';
import { dateToString, startOfWeekMonday } from '@my-hub/shared/utils';
import { GetMenuResponseSchema, GetMenusResponseSchema } from '@/app/api/calories/menu/menu.schemas';
import { WeekNavigator } from './WeekNavigator';
import { EmptyState } from './EmptyState';
import { MenuDetail } from './MenuDetail';
import { toLoggedMeals } from './menu.utils';
import type { LoggedMeals } from './menu.utils';
import type { WeeklyMenu, WeeklyMenuSummary } from './types';

export default function WeeklyMenuPage() {
  const [menus, setMenus] = useState<WeeklyMenuSummary[]>([]);
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
      const data = await apiFetch('/api/calories/menu', { responseSchema: GetMenusResponseSchema });
      setMenus(data.menus);
      setGymDays(data.gymDays);
      const current = data.menus.find(m => m.weekStart === currentWeekStart);
      if (current) {
        const detail = await apiFetch(`/api/calories/menu/${current.menuId}`, {
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
