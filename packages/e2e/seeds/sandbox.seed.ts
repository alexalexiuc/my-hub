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
} from '@my-hub/shared/services';
import { AccountTypes, CategoryIcons, TransactionTypes } from '@my-hub/shared/constants';
import { shiftMonthStr } from '@my-hub/shared/utils';
import { SANDBOX_USER, SANDBOX_BUDGET_NAME } from '../constants';

/**
 * Demo data for the local UI sandbox (`pnpm ui:sandbox`) — enough finance history that every
 * Cashflow, Reporting and Accounts view has something to render. This is NOT an E2E fixture:
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

  return { budgetId: budget.id };
}
