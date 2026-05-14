import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoryIcons } from '@my-hub/shared/constants';
import { createCategory, createGroup, getGroups, getUserActiveBudget } from '@my-hub/shared/services';
import { UpsertCategorySchema, upsertCategoryTool } from './categories';
import { financesContext, parseToolPayload } from './test-utils';

vi.mock('@my-hub/shared/services', () => ({
  getUserActiveBudget: vi.fn(),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  getAccountById: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  getCategoryById: vi.fn(),
  getGroups: vi.fn(),
  createGroup: vi.fn(),
  addTransaction: vi.fn(),
}));

describe('UpsertCategorySchema', () => {
  it('requires icon and color', () => {
    const parsed = UpsertCategorySchema.safeParse({
      name: 'Groceries',
    });

    expect(parsed.success).toBe(false);
  });

  it('accepts only known category icons', () => {
    const parsed = UpsertCategorySchema.safeParse({
      name: 'Groceries',
      icon: 'not_a_real_icon',
      color: '#6ee7b7',
    });

    expect(parsed.success).toBe(false);
  });
});

describe('upsertCategoryTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserActiveBudget).mockResolvedValue({ id: 1 } as never);
  });

  it('creates the group when groupName does not exist', async () => {
    vi.mocked(getGroups)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ id: 99, name: 'Auto Group' }] as never);
    vi.mocked(createGroup).mockResolvedValue({ id: 99, name: 'Auto Group' } as never);
    vi.mocked(createCategory).mockResolvedValue({
      id: 44,
      name: 'Groceries',
      groupId: 99,
      monthlyTarget: null,
    } as never);

    const result = await upsertCategoryTool(
      {
        id: undefined,
        name: 'Groceries',
        icon: CategoryIcons.ShoppingCart,
        color: '#6ee7b7',
        groupName: 'Auto Group',
        monthlyTarget: undefined,
      },
      financesContext,
    );

    expect(createGroup).toHaveBeenCalledWith('user-1', 1, { name: 'Auto Group' });
    expect(createCategory).toHaveBeenCalledWith(
      'user-1',
      1,
      expect.objectContaining({
        name: 'Groceries',
        icon: CategoryIcons.ShoppingCart,
        color: '#6ee7b7',
        groupId: 99,
      }),
    );

    const payload = parseToolPayload(result) as { group: string | null };
    expect(payload.group).toBe('Auto Group');
  });
});
