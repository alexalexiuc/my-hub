import {
  findUserByEmail,
  createUserWithPassword,
  verifyUserEmail,
  getUserBudgets,
  createBudget,
  deleteBudget,
  setActiveBudget,
  createAccount,
  createGroup,
  createCategory,
  addTransaction,
  upsertPayee,
  upsertCalorieProfile,
  logMeasurementsBatch,
  logMeal,
  deleteAllUserMeasurements,
  deleteAllUserMeals,
  deleteAllUserCalorieProfiles,
} from '@my-hub/shared/services';
import {
  AccountTypes,
  ActivityLevels,
  CategoryIcons,
  GoalTypes,
  MealTypes,
  Sexes,
  TransactionTypes,
} from '@my-hub/shared/constants';
import { shiftDateStr, shiftMonthStr } from '@my-hub/shared/utils';
import { SANDBOX_USER, SANDBOX_BUDGET_NAME } from '../constants';

/**
 * A deterministic pseudo-random value in [-1, 1] for a given day index. The sandbox must look the
 * same on every run, so the weigh-in noise is generated rather than random.
 */
function dayJitter(index: number): number {
  return Math.sin(index * 12.9898) * 43758.5453 - Math.floor(Math.sin(index * 12.9898) * 43758.5453) - 0.5;
}

/**
 * Calorie-tracker demo data: a weight-loss goal roughly ten weeks in, with a daily weigh-in
 * history and two weeks of meals.
 *
 * The weigh-ins are deliberately noisy around a clean underlying trend, including one heavy
 * weekend, because that is the case the Progress page exists to read correctly — a smooth series
 * would make the trend line and the raw line indistinguishable and prove nothing.
 */
async function seedCaloriesFixtures(userId: string): Promise<void> {
  // Rebuilt from scratch each run, matching how the budget above is dropped and recreated —
  // otherwise repeated `pnpm ui:sandbox` runs would stack duplicate weigh-ins on the same dates.
  await deleteAllUserMeals(userId);
  await deleteAllUserMeasurements(userId);
  await deleteAllUserCalorieProfiles(userId);

  const today = new Date().toISOString().slice(0, 10);
  const days = 80;
  const startDate = shiftDateStr(today, -(days - 1));

  const startWeight = 98;
  const trendPerDay = -0.75 / 7; // the goal rate, which the data roughly but imperfectly follows

  const weighIns = Array.from({ length: days }, (_, i) => {
    // Actual loss runs a little slower than the goal — the demo should not look like a solved
    // problem — and one weekend two weeks ago spikes on water.
    const underlying = startWeight + trendPerDay * 0.85 * i;
    const daysAgo = days - 1 - i;
    const badWeekend = daysAgo >= 12 && daysAgo <= 14 ? 1.1 : 0;
    return {
      typeKey: 'weight' as const,
      date: shiftDateStr(startDate, i),
      value: parseFloat((underlying + dayJitter(i) * 1.2 + badWeekend).toFixed(1)),
    };
  });

  await logMeasurementsBatch(userId, weighIns, 'hub');
  await logMeasurementsBatch(
    userId,
    [
      { typeKey: 'height', value: 181, date: startDate },
      { typeKey: 'body_fat', value: 24.5, date: shiftDateStr(today, -30) },
      { typeKey: 'waist', value: 96, date: shiftDateStr(today, -30) },
      { typeKey: 'body_fat', value: 22.8, date: today },
      { typeKey: 'waist', value: 92, date: today },
    ],
    'hub',
  );

  // The goal baseline is stamped explicitly so the projection is anchored where the run actually
  // began, rather than being inferred from the oldest weigh-in on hand.
  await upsertCalorieProfile(userId, {
    age: 36,
    sex: Sexes.Male,
    heightCm: 181,
    activityLevel: ActivityLevels.ModeratelyActive,
    goalType: GoalTypes.WeightLoss,
    goalWeeklyRateKg: 0.75,
    goalStartDate: weighIns[0]!.date,
    goalStartWeightKg: weighIns[0]!.value,
    gymDays: [0, 2, 4],
    gymTime: 'evening',
  });

  const menu = [
    { mealType: MealTypes.Breakfast, description: 'Greek yoghurt, berries, honey', kcal: 420, p: 32, c: 48, f: 11 },
    { mealType: MealTypes.Lunch, description: 'Chicken, rice and roasted veg', kcal: 680, p: 52, c: 74, f: 18 },
    { mealType: MealTypes.Dinner, description: 'Salmon with potatoes and greens', kcal: 620, p: 44, c: 46, f: 27 },
    { mealType: MealTypes.Snack, description: 'Protein shake and an apple', kcal: 280, p: 26, c: 32, f: 4 },
  ];

  for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
    const date = shiftDateStr(today, -daysAgo);
    // A couple of heavier days so the weekly chart is not a flat row of identical bars.
    const swing = daysAgo % 5 === 0 ? 1.18 : daysAgo % 3 === 0 ? 0.88 : 1;
    for (const [index, meal] of menu.entries()) {
      // The last day is still in progress — dinner and the snack have not happened yet.
      if (daysAgo === 0 && index >= 2) continue;
      await logMeal({
        userId,
        mealId: `sandbox-${date}-${meal.mealType}`,
        date,
        mealType: meal.mealType,
        description: meal.description,
        kcal: Math.round(meal.kcal * swing),
        protein: Math.round(meal.p * swing),
        carbs: Math.round(meal.c * swing),
        fat: Math.round(meal.f * swing),
      });
    }
  }
}

/**
 * Demo data for the local UI sandbox (`pnpm ui:sandbox`) — enough finance history that every
 * Cashflow, Reporting and Accounts view has something to render, plus a calorie profile with a
 * weight-loss goal in progress so the Calories tabs are populated too. This is NOT an E2E fixture:
 * tests must not assert against it, so the numbers here are free to change.
 *
 * Idempotent: the sandbox budget is dropped and rebuilt on every run.
 *
 * @param monthsOfHistory How many months back to generate, current month inclusive. Spanning more
 *   than 12 gives the Cashflow page's year carousel a previous year to page into.
 */
export async function seedSandboxFixtures(monthsOfHistory = 21): Promise<{ budgetId: number }> {
  let user = await findUserByEmail(SANDBOX_USER.email);
  if (!user) {
    user = await createUserWithPassword(SANDBOX_USER.email, SANDBOX_USER.password, SANDBOX_USER.name);
  }
  if (!user.emailVerified) await verifyUserEmail(user.id);

  for (const existing of await getUserBudgets(user.id)) {
    if (existing.name === SANDBOX_BUDGET_NAME) await deleteBudget(user.id, existing.id);
  }

  const budget = await createBudget(user.id, { name: SANDBOX_BUDGET_NAME, defaultCurrency: 'EUR' });
  await setActiveBudget(user.id, budget.id);

  const current = await createAccount(user.id, budget.id, {
    name: 'Revolut Current',
    type: AccountTypes.Bank,
    currency: 'EUR',
    balance: 0,
  });
  const savings = await createAccount(user.id, budget.id, {
    name: 'Savings Pot',
    type: AccountTypes.Goal,
    currency: 'EUR',
    balance: 0,
    details: { type: AccountTypes.Goal, targetAmount: 20000 },
  });
  const card = await createAccount(user.id, budget.id, {
    name: 'Amex Gold',
    type: AccountTypes.CreditCard,
    currency: 'EUR',
    balance: 0,
    details: { type: AccountTypes.CreditCard, creditLimit: 5000, statementDay: 15 },
  });
  // Deliberately left without transactions — proves views that hide idle accounts actually do.
  await createAccount(user.id, budget.id, {
    name: 'Old Cash Box',
    type: AccountTypes.Cash,
    currency: 'EUR',
    balance: 0,
  });

  const essentials = await createGroup(user.id, budget.id, { name: 'Essentials' });
  const lifestyle = await createGroup(user.id, budget.id, { name: 'Lifestyle' });

  const groceries = await createCategory(user.id, budget.id, {
    name: 'Groceries',
    icon: CategoryIcons.ShoppingCart,
    color: '#34d399',
    monthlyTarget: 500,
    groupId: essentials.id,
  });
  const transport = await createCategory(user.id, budget.id, {
    name: 'Transport',
    icon: CategoryIcons.Fuel,
    color: '#60a5fa',
    monthlyTarget: 180,
    groupId: essentials.id,
  });
  const dining = await createCategory(user.id, budget.id, {
    name: 'Dining',
    icon: CategoryIcons.UtensilsCrossed,
    color: '#f472b6',
    monthlyTarget: 250,
    groupId: lifestyle.id,
  });

  const lidl = await upsertPayee(user.id, budget.id, 'Lidl');
  const shell = await upsertPayee(user.id, budget.id, 'Shell');

  const thisMonth = new Date().toISOString().slice(0, 7);

  for (let back = monthsOfHistory - 1; back >= 0; back--) {
    const month = shiftMonthStr(thisMonth, -back);
    // A slow upward drift, so charts and month-over-month deltas are not flat.
    const drift = (monthsOfHistory - 1 - back) * 37;

    await addTransaction(user.id, budget.id, {
      accountId: current.id,
      type: TransactionTypes.Income,
      amount: 4200 + drift,
      date: `${month}-02`,
      notes: 'Salary',
    });
    await addTransaction(user.id, budget.id, {
      accountId: current.id,
      type: TransactionTypes.Expense,
      amount: 430 + drift,
      date: `${month}-06`,
      categoryId: groceries.id,
      payeeId: lidl.id,
    });
    await addTransaction(user.id, budget.id, {
      accountId: card.id,
      type: TransactionTypes.Expense,
      amount: 180 + drift / 2,
      date: `${month}-11`,
      categoryId: dining.id,
    });
    await addTransaction(user.id, budget.id, {
      accountId: current.id,
      type: TransactionTypes.Expense,
      amount: 140,
      date: `${month}-14`,
      categoryId: transport.id,
      payeeId: shell.id,
    });
    await addTransaction(user.id, budget.id, {
      accountId: current.id,
      type: TransactionTypes.Transfer,
      amount: 900,
      date: `${month}-20`,
      toAccountId: savings.id,
      notes: 'Monthly saving',
    });
    await addTransaction(user.id, budget.id, {
      accountId: current.id,
      type: TransactionTypes.Transfer,
      amount: 180 + drift / 2,
      date: `${month}-25`,
      toAccountId: card.id,
      notes: 'Card repayment',
    });
  }

  // One withdrawal back out of savings, so at least one account-month is net negative.
  await addTransaction(user.id, budget.id, {
    accountId: savings.id,
    type: TransactionTypes.Transfer,
    amount: 2500,
    date: `${shiftMonthStr(thisMonth, -2)}-18`,
    toAccountId: current.id,
    notes: 'Holiday withdrawal',
  });

  await seedCaloriesFixtures(user.id);

  return { budgetId: budget.id };
}
