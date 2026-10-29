import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoryIcons } from '@my-hub/shared/constants';
import {
  createCategory,
  createGroup,
  getCategoryById,
  getGroups,
  getUserActiveBudget,
  updateCategory,
} from '@my-hub/shared/services';
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
  it('accepts an update without icon and color', () => {
    const parsed = UpsertCategorySchema.safeParse({ id: 14, monthlyTarget: 16000 });

    expect(parsed.success).toBe(true);
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

  it('requires icon and color when creating', async () => {
    await expect(
      upsertCategoryTool({ name: 'Groceries' } as Parameters<typeof upsertCategoryTool>[0], financesContext),
    ).rejects.toThrow('name, icon and color are required when creating a category');
    expect(createCategory).not.toHaveBeenCalled();
  });

  it('leaves icon and color untouched when updating other fields', async () => {
    vi.mocked(getCategoryById).mockResolvedValue({ id: 14 } as never);
    vi.mocked(updateCategory).mockResolvedValue({
      id: 14,
      name: 'Grocery',
      groupId: null,
      monthlyTarget: 16000,
    } as never);

    await upsertCategoryTool(
      { id: 14, monthlyTarget: 16000 } as Parameters<typeof upsertCategoryTool>[0],
      financesContext,
    );

    expect(updateCategory).toHaveBeenCalledWith(
      'user-1',
      1,
      14,
      expect.objectContaining({ icon: undefined, color: undefined, monthlyTarget: 16000 }),
    );
  });
});
