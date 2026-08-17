import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getE2eEnv } from './helpers/env.js';
import { generateToken } from './helpers/token.js';
import { createMcpClient, parseToolResult, type McpClient } from './helpers/mcp-client.js';

interface MenuMeal {
  id: number;
  menuId: string;
  dayOfWeek: number;
  mealType: string;
  description: string;
  ingredients: string[] | null;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

interface PlanWeekResult {
  menuId: string;
  weekStart: string;
  title: string | null;
  totalMeals: number;
  prepNotes: string | null;
  shoppingListItems: number;
  planFromDayOfWeek: number;
  success?: false;
  message: string;
}

interface GetMenuResult {
  menu: { menuId: string; weekStart: string; title: string | null; notes: string | null; meals: MenuMeal[] } | null;
  gymDays: number[] | null;
  gymTime: string | null;
}

interface ListMenusResult {
  menus: { menuId: string; weekStart: string }[];
}

interface MutationResult {
  success: boolean;
  message: string;
  meal?: MenuMeal;
  prepNotes?: string | null;
  itemCount?: number;
}

/**
 * E2e tests for the weekly-menu MCP tools, over the MCP protocol.
 *
 * Covers the whole surface a model touches when it plans a week: plan_week →
 * get_weekly_menu → set/remove a slot → prep notes → shopping list → delete.
 *
 * Uses a far-future week (2099-01-05, a Monday) so nothing collides with real menus, and
 * deletes the menu afterwards even if an assertion fails part-way through.
 */
describe.sequential('calories — weekly menu lifecycle', () => {
  let client: McpClient;
  /** Reassigned whenever plan_week replaces the week — the replacement gets a fresh menuId. */
  let menuId = '';

  const weekStart = '2099-01-05';
  /** Only ever used for the duplicate-slot rejection, which must not write anything. */
  const rejectedWeekStart = '2099-01-12';
  const runId = Date.now().toString(36);
  const tag = `[e2e:${runId}]`;

  const planMeals = [
    {
      dayOfWeek: 0,
      mealType: 'breakfast',
      description: `${tag} Oats with peanut butter`,
      ingredients: ['80g oats', '20g peanut butter', '250ml milk'],
      kcal: 520,
      protein: 24,
      carbs: 62,
      fat: 18,
    },
    { dayOfWeek: 0, mealType: 'lunch', description: `${tag} Chicken and rice`, kcal: 640 },
    { dayOfWeek: 1, mealType: 'breakfast', description: `${tag} Omelette`, kcal: 480 },
  ];

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    const token = await generateToken();
    client = await createMcpClient(baseUrl, '/calories/mcp', token);
  });

  afterAll(async () => {
    // Both weeks, not just the one this run tracked. If the duplicate-slot guard ever regresses,
    // the rejected call writes a menu the assertions never learn about — and the next run then
    // fails on "no menu for this week" forever after, hiding the real regression behind stale data.
    for (const week of [weekStart, rejectedWeekStart]) {
      try {
        const { menu } = parseToolResult<GetMenuResult>(
          await client.callTool({ name: 'calories_get_weekly_menu', arguments: { weekStart: week } }),
        );
        if (menu) {
          await client.callTool({ name: 'calories_delete_weekly_menu', arguments: { menuId: menu.menuId } });
        }
      } catch {
        // best-effort cleanup — never fail the run on it
      }
    }
    await client.close();
  });

  // -------------------------------------------------------------------------
  // plan_week
  // -------------------------------------------------------------------------

  it('plans a week with meals, prep notes and a shopping list in one call', async () => {
    const result = await client.callTool({
      name: 'calories_plan_week',
      arguments: {
        weekStart,
        title: `${tag} High protein week`,
        prepNotes: 'Sunday: boil 1kg chicken. Cook 500g rice.',
        shoppingList: ['1kg chicken breast', '500g rice', '6 eggs'],
        meals: planMeals,
      },
    });

    const data = parseToolResult<PlanWeekResult>(result);

    expect(data.menuId).toBeTruthy();
    expect(data.weekStart).toBe(weekStart);
    expect(data.totalMeals).toBe(3);
    expect(data.shoppingListItems).toBe(3);
    expect(data.prepNotes).toBe('Sunday: boil 1kg chicken. Cook 500g rice.');
    // A future week is planned in full — the "skip past days" rule is for the current week only.
    expect(data.planFromDayOfWeek).toBe(0);

    menuId = data.menuId;
  });

  it('round-trips ingredients, macros and prep notes through get_weekly_menu', async () => {
    const result = await client.callTool({ name: 'calories_get_weekly_menu', arguments: { weekStart } });
    const data = parseToolResult<GetMenuResult>(result);

    expect(data.menu).not.toBeNull();
    expect(data.menu!.menuId).toBe(menuId);
    expect(data.menu!.notes).toBe('Sunday: boil 1kg chicken. Cook 500g rice.');
    expect(data.menu!.meals).toHaveLength(3);

    const breakfast = data.menu!.meals.find(m => m.dayOfWeek === 0 && m.mealType === 'breakfast');
    expect(breakfast).toBeDefined();
    expect(breakfast!.ingredients).toEqual(['80g oats', '20g peanut butter', '250ml milk']);
    expect(breakfast!.kcal).toBe(520);
    expect(breakfast!.protein).toBe(24);

    // A meal planned without ingredients stores null, not an empty array — "no ingredients"
    // has to have one representation or the UI has two empty states to render.
    const lunch = data.menu!.meals.find(m => m.dayOfWeek === 0 && m.mealType === 'lunch');
    expect(lunch!.ingredients).toBeNull();
  });

  it('lists the menu when weekStart is omitted', async () => {
    const result = await client.callTool({ name: 'calories_get_weekly_menu', arguments: {} });
    const data = parseToolResult<ListMenusResult>(result);

    expect(data.menus.some(m => m.menuId === menuId && m.weekStart === weekStart)).toBe(true);
  });

  it('rejects a duplicate (day, mealType) slot instead of silently dropping it', async () => {
    const result = await client.callTool({
      name: 'calories_plan_week',
      arguments: {
        weekStart: rejectedWeekStart,
        meals: [
          { dayOfWeek: 0, mealType: 'breakfast', description: `${tag} first`, kcal: 400 },
          { dayOfWeek: 0, mealType: 'breakfast', description: `${tag} second`, kcal: 400 },
        ],
      },
    });

    const data = parseToolResult<PlanWeekResult>(result);
    expect(data.success).toBe(false);
    expect(data.message).toMatch(/duplicate meal slot/i);

    // The rejection must happen before any write — otherwise a rejected call still
    // replaces whatever menu that week already had.
    const check = await client.callTool({
      name: 'calories_get_weekly_menu',
      arguments: { weekStart: rejectedWeekStart },
    });
    expect(parseToolResult<GetMenuResult>(check).menu).toBeNull();
  });

  // -------------------------------------------------------------------------
  // set_menu_meal
  // -------------------------------------------------------------------------

  it('overwrites an occupied slot rather than adding a second meal to it', async () => {
    const result = await client.callTool({
      name: 'calories_set_menu_meal',
      arguments: {
        menuId,
        dayOfWeek: 0,
        mealType: 'lunch',
        description: `${tag} Salmon and quinoa`,
        ingredients: ['180g salmon', '80g quinoa'],
        kcal: 700,
      },
    });

    const data = parseToolResult<MutationResult>(result);
    expect(data.success).toBe(true);
    expect(data.meal!.description).toBe(`${tag} Salmon and quinoa`);

    const menu = parseToolResult<GetMenuResult>(
      await client.callTool({ name: 'calories_get_weekly_menu', arguments: { weekStart } }),
    );
    expect(menu.menu!.meals).toHaveLength(3); // replaced, not appended
    const lunches = menu.menu!.meals.filter(m => m.dayOfWeek === 0 && m.mealType === 'lunch');
    expect(lunches).toHaveLength(1);
    expect(lunches[0]!.ingredients).toEqual(['180g salmon', '80g quinoa']);
    expect(lunches[0]!.kcal).toBe(700);
  });

  it('adds a meal to an empty slot', async () => {
    const result = await client.callTool({
      name: 'calories_set_menu_meal',
      arguments: { menuId, dayOfWeek: 1, mealType: 'dinner', description: `${tag} Beef stew`, kcal: 600 },
    });

    expect(parseToolResult<MutationResult>(result).success).toBe(true);

    const menu = parseToolResult<GetMenuResult>(
      await client.callTool({ name: 'calories_get_weekly_menu', arguments: { weekStart } }),
    );
    expect(menu.menu!.meals).toHaveLength(4);
  });

  it('clears ingredients when the slot is overwritten without them', async () => {
    await client.callTool({
      name: 'calories_set_menu_meal',
      arguments: { menuId, dayOfWeek: 0, mealType: 'lunch', description: `${tag} Plain rice bowl`, kcal: 500 },
    });

    const menu = parseToolResult<GetMenuResult>(
      await client.callTool({ name: 'calories_get_weekly_menu', arguments: { weekStart } }),
    );
    const lunch = menu.menu!.meals.find(m => m.dayOfWeek === 0 && m.mealType === 'lunch');
    expect(lunch!.ingredients).toBeNull();
  });

  it('reports failure for set_menu_meal on an unknown menu', async () => {
    const result = await client.callTool({
      name: 'calories_set_menu_meal',
      arguments: {
        menuId: '00000000-0000-0000-0000-000000000000',
        dayOfWeek: 0,
        mealType: 'breakfast',
        description: `${tag} nope`,
      },
    });

    expect(parseToolResult<MutationResult>(result).success).toBe(false);
  });

  // -------------------------------------------------------------------------
  // remove_menu_meal
  // -------------------------------------------------------------------------

  it('removes a single meal and leaves the rest of the week intact', async () => {
    const result = await client.callTool({
      name: 'calories_remove_menu_meal',
      arguments: { menuId, dayOfWeek: 1, mealType: 'dinner' },
    });

    expect(parseToolResult<MutationResult>(result).success).toBe(true);

    const menu = parseToolResult<GetMenuResult>(
      await client.callTool({ name: 'calories_get_weekly_menu', arguments: { weekStart } }),
    );
    expect(menu.menu!.meals).toHaveLength(3);
    expect(menu.menu!.meals.some(m => m.dayOfWeek === 1 && m.mealType === 'dinner')).toBe(false);
  });

  it('reports failure when removing a slot that is already empty', async () => {
    const result = await client.callTool({
      name: 'calories_remove_menu_meal',
      arguments: { menuId, dayOfWeek: 1, mealType: 'dinner' },
    });

    expect(parseToolResult<MutationResult>(result).success).toBe(false);
  });

  // -------------------------------------------------------------------------
  // prep notes + shopping list
  // -------------------------------------------------------------------------

  it('updates and clears prep notes without touching the meals', async () => {
    const set = await client.callTool({
      name: 'calories_set_prep_notes',
      arguments: { menuId, prepNotes: 'Wednesday: hard-boil 6 eggs.' },
    });
    const setData = parseToolResult<MutationResult>(set);
    expect(setData.success).toBe(true);
    expect(setData.prepNotes).toBe('Wednesday: hard-boil 6 eggs.');

    const cleared = await client.callTool({
      name: 'calories_set_prep_notes',
      arguments: { menuId, prepNotes: '   ' },
    });
    expect(parseToolResult<MutationResult>(cleared).prepNotes).toBeNull();

    const menu = parseToolResult<GetMenuResult>(
      await client.callTool({ name: 'calories_get_weekly_menu', arguments: { weekStart } }),
    );
    expect(menu.menu!.notes).toBeNull();
    expect(menu.menu!.meals).toHaveLength(3);
  });

  it('replaces the shopping list and dedupes case-insensitively', async () => {
    const result = await client.callTool({
      name: 'calories_set_shopping_list',
      arguments: { menuId, items: ['  Eggs  ', 'eggs', '2kg potatoes', ''] },
    });

    const data = parseToolResult<MutationResult>(result);
    expect(data.success).toBe(true);
    expect(data.itemCount).toBe(2); // "Eggs" + "2kg potatoes"
  });

  it('clears the shopping list when given an empty array', async () => {
    const result = await client.callTool({ name: 'calories_set_shopping_list', arguments: { menuId, items: [] } });
    const data = parseToolResult<MutationResult>(result);

    expect(data.success).toBe(true);
    expect(data.itemCount).toBe(0);
  });

  // -------------------------------------------------------------------------
  // replace + delete
  // -------------------------------------------------------------------------

  it('replaces the whole week when plan_week is called again for the same Monday', async () => {
    const previousMenuId = menuId;

    const result = await client.callTool({
      name: 'calories_plan_week',
      arguments: {
        weekStart,
        title: `${tag} Replacement week`,
        meals: [{ dayOfWeek: 3, mealType: 'dinner', description: `${tag} Only meal`, kcal: 600 }],
      },
    });

    const data = parseToolResult<PlanWeekResult>(result);
    expect(data.menuId).not.toBe(previousMenuId);
    expect(data.totalMeals).toBe(1);
    menuId = data.menuId;

    // One menu per week: the old one and all its meals are gone, not orphaned alongside.
    const menu = parseToolResult<GetMenuResult>(
      await client.callTool({ name: 'calories_get_weekly_menu', arguments: { weekStart } }),
    );
    expect(menu.menu!.menuId).toBe(menuId);
    expect(menu.menu!.meals).toHaveLength(1);

    const list = parseToolResult<ListMenusResult>(
      await client.callTool({ name: 'calories_get_weekly_menu', arguments: {} }),
    );
    expect(list.menus.some(m => m.menuId === previousMenuId)).toBe(false);
  });

  it('deletes the menu and reports failure on a second delete', async () => {
    const first = await client.callTool({ name: 'calories_delete_weekly_menu', arguments: { menuId } });
    expect(parseToolResult<MutationResult>(first).success).toBe(true);

    const second = await client.callTool({ name: 'calories_delete_weekly_menu', arguments: { menuId } });
    expect(parseToolResult<MutationResult>(second).success).toBe(false);

    const menu = parseToolResult<GetMenuResult>(
      await client.callTool({ name: 'calories_get_weekly_menu', arguments: { weekStart } }),
    );
    expect(menu.menu).toBeNull();

    menuId = '';
  });
});
