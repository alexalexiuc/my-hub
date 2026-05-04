import {
  findUserByEmail,
  findOrCreateUser,
  getUserBudgets,
  createBudget,
  deleteBudget,
  addBudgetMember,
} from '@my-hub/shared/services';
import { SHARED_FINANCE_FIXTURE } from '../constants';

export interface SharedFinanceFixture {
  budgetName: string;
  ownerEmail: string;
  memberEmail: string;
}

/**
 * Seeds a shared finance budget fixture:
 * - Creates (or re-creates) a budget owned by SHARED_FINANCE_MEMBER_EMAIL's counterpart
 * - Adds the test viewer as a member so the member-removal flow can be tested
 *
 * The fixture is owned by SHARED_FINANCE_MEMBER_EMAIL and the test user is added as a member.
 * This allows the test to log in as SHARED_FINANCE_MEMBER_EMAIL and verify member management.
 */
export async function seedSharedFinanceFixture(viewerEmail: string): Promise<SharedFinanceFixture> {
  const viewer = await findUserByEmail(viewerEmail);
  if (!viewer) {
    throw new Error(`Unable to find viewer user by email: ${viewerEmail}`);
  }

  const { budgetName, ownerEmail } = SHARED_FINANCE_FIXTURE;

  const owner = await findOrCreateUser(ownerEmail, 'E2E Finance Owner');

  // Idempotent: delete any previously seeded budgets with the same name
  const existingBudgets = await getUserBudgets(owner.id);
  for (const b of existingBudgets.filter(b => b.name === budgetName)) {
    await deleteBudget(owner.id, b.id);
  }

  const budget = await createBudget(owner.id, {
    name: budgetName,
    defaultCurrency: 'EUR',
  });

  // Add the test user as a member so they appear in settings
  await addBudgetMember(owner.id, budget.id, viewer.id);

  return { budgetName, ownerEmail, memberEmail: viewerEmail };
}
