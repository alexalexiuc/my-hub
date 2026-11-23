'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { apiFetch } from '@/lib/utils';
import { Button } from '@/components';
import { PlusOutlineIcon } from '@/components/icons';
import { GetMenuResponseSchema, GetMenusResponseSchema } from '@/app/api/calories/menu/menu.schemas';
import type { GymTime } from '@my-hub/shared/constants';
import { formatWeekRangeStr } from '@my-hub/shared/utils';
import { useRefetchOnVisible } from '@/hooks/useRefetchOnVisible';
import { WeekNavigator } from './WeekNavigator';
import { EmptyState } from './EmptyState';
import { MenuDetail } from './MenuDetail';
import { CreateMenuModal } from './CreateMenuModal';
import { toLoggedMeals, nextMenuWeekStart, initialMenuWeek, currentWeekMonday } from './menu.utils';
import type { DayTarget, LoggedMeals } from './menu.utils';
import type { WeeklyMenu, WeeklyMenuSummary } from './types';

export default function WeeklyMenuPage() {
  const [menus, setMenus] = useState<WeeklyMenuSummary[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<WeeklyMenu | null>(null);
  const [loggedMeals, setLoggedMeals] = useState<LoggedMeals>({});
  const [gymDays, setGymDays] = useState<number[]>([]);
  const [dayTargets, setDayTargets] = useState<DayTarget[]>([]);
  const [gymTime, setGymTime] = useState<GymTime | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  /** Week the create modal opens on — null while it's closed. */
  const [createWeek, setCreateWeek] = useState<string | null>(null);

  // Stable for the component's lifetime — recomputing on every render would only churn
  // the loadMenus useCallback identity and re-trigger its effect.
  const currentWeekStart = useMemo(() => currentWeekMonday(), []);
  /** The week on screen — with or without a menu. The first load moves it to `initialMenuWeek`. */
  const [selectedWeek, setSelectedWeek] = useState(currentWeekStart);
  const selectedHasMenu = menus.some(m => m.weekStart === selectedWeek);
  // The loaded menu only counts once it is the selected week's: while another week loads, the old one
  // isn't shown (or copied) under the new label.
  const shownMenu = selectedMenu?.weekStart === selectedWeek ? selectedMenu : null;
  const canPlan = selectedWeek >= currentWeekStart;

  // Bumped by every navigation. A response that comes back for an older one is dropped, so a slow
  // week (or a background refresh started before the click) can't overwrite the week on screen.
  const navToken = useRef(0);

  /**
   * Shows a week: loads its menu when one is saved, or the empty week otherwise. `silent` (a
   * background refresh) fails quietly — no toast, no banner for a fetch the user didn't start.
   */
  const showWeek = useCallback(async (weekStart: string, menuList: WeeklyMenuSummary[], silent = false) => {
    const token = ++navToken.current;
    setSelectedWeek(weekStart);
    const summary = menuList.find(m => m.weekStart === weekStart);
    if (!summary) {
      setSelectedMenu(null);
      setLoggedMeals({});
      return;
    }
    try {
      const detail = await apiFetch(`/api/calories/menu/${summary.menuId}`, {
        responseSchema: GetMenuResponseSchema,
        silentToast: silent,
      });
      if (token !== navToken.current) return;
      setSelectedMenu(detail.menu);
      setLoggedMeals(toLoggedMeals(detail.loggedDays));
    } catch {
      if (!silent && token === navToken.current) setError('Failed to load menu details');
    }
  }, []);

  /**
   * Fetches the menu list and targets, then shows the week the page opens on (`initialMenuWeek`).
   * Given `refreshWeek`, it's a background refresh instead: no loading screen, no error shown, and
   * it stays on that week — unless the user moved to another week while it ran.
   */
  const loadMenus = useCallback(
    async (refreshWeek?: string) => {
      const silent = refreshWeek !== undefined;
      const startToken = navToken.current;
      try {
        if (!silent) setLoading(true);
        const data = await apiFetch('/api/calories/menu', {
          responseSchema: GetMenusResponseSchema,
          silentToast: silent,
        });
        setError(null);
        setMenus(data.menus);
        setGymDays(data.gymDays);
        setDayTargets(data.dayTargets);
        setGymTime(data.gymTime);
        if (silent && navToken.current !== startToken) return;
        await showWeek(refreshWeek ?? initialMenuWeek(data.menus, currentWeekStart), data.menus, silent);
      } catch (e) {
        if (!silent) setError(e instanceof Error ? e.message : 'Failed to load menus');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [currentWeekStart, showWeek],
  );

  useEffect(() => {
    void loadMenus();
  }, [loadMenus]);

  // Menus are often written by Claude while this tab sits open, so a week planned elsewhere shows
  // up when the tab comes back into view — staying on the week on screen.
  useRefetchOnVisible(() => loadMenus(selectedWeek));

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
    navToken.current += 1; // a menu still loading for another week must not replace this one
    setSelectedWeek(createdMenu.weekStart);
    setSelectedMenu(createdMenu);
    setLoggedMeals({});
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-[var(--subtle)]">Loading menus…</div>;
  }

  return (
    <main className="flex flex-col gap-6 max-w-5xl mx-auto">
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
          onClick={() => setCreateWeek(nextMenuWeekStart(menus, currentWeekStart))}
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

      {createWeek !== null && (
        <CreateMenuModal
          onClose={() => setCreateWeek(null)}
          onCreated={menu => void handleCreated(menu)}
          gymDays={gymDays}
          defaultWeekStart={createWeek}
          existingWeekStarts={menus.map(m => m.weekStart)}
          copyFrom={shownMenu}
        />
      )}

      {error && (
        <div className="rounded-xl border border-[var(--red)] bg-[var(--red-d)] px-4 py-3 text-sm text-[var(--red)]">
          {error}
        </div>
      )}

      {menus.length === 0 ? (
        <EmptyState
          title="No weekly menus yet"
          hint={
            <>
              Ask Claude: <span className="italic">&quot;Plan my meals for next week&quot;</span> or use the Create
              button above.
            </>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          <WeekNavigator
            menus={menus}
            selectedWeek={selectedWeek}
            currentWeekStart={currentWeekStart}
            onSelectWeek={week => void showWeek(week, menus)}
          />

          {!selectedHasMenu && (
            <EmptyState
              title={`No menu for ${formatWeekRangeStr(selectedWeek)}`}
              hint={
                canPlan ? (
                  <>
                    Ask Claude: <span className="italic">&quot;Plan my meals for this week&quot;</span>, or plan it
                    here.
                  </>
                ) : (
                  'Nothing was planned for this week.'
                )
              }
              action={
                canPlan && (
                  <Button
                    variant="accent"
                    size="sm"
                    onClick={() => setCreateWeek(selectedWeek)}
                    className="flex items-center"
                  >
                    <PlusOutlineIcon className="mr-1.5 h-4 w-4" />
                    Plan this week
                  </Button>
                )
              }
            />
          )}

          {shownMenu && (
            <MenuDetail
              menu={shownMenu}
              loggedMeals={loggedMeals}
              gymDays={gymDays}
              dayTargets={dayTargets}
              gymTime={gymTime}
              onMetaUpdated={meta => {
                setSelectedMenu(prev => (prev ? { ...prev, ...meta } : prev));
                setMenus(prev => prev.map(m => (m.menuId === shownMenu.menuId ? { ...m, ...meta } : m)));
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
              isCurrentWeek={shownMenu.weekStart === currentWeekStart}
            />
          )}
        </div>
      )}
    </main>
  );
}
