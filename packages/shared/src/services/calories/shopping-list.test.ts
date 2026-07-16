/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getShoppingListItems,
  addShoppingListItems,
  setShoppingListItemChecked,
  deleteShoppingListItem,
  deleteAllUserShoppingListItems,
} from './shopping-list';

// ---------------------------------------------------------------------------
// Mock the DB client
// ---------------------------------------------------------------------------

vi.mock('../../db/client.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { db } from '../../db/client.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Row shape returned by the hasAccessToMenu count query */
const ACCESS_GRANTED_ROW = { count: 1 };
const ACCESS_DENIED_ROW = { count: 0 };

const ITEM_ROW = {
  id: 1,
  menuId: 'menu-abc',
  userId: 'user-1',
  text: 'olive oil',
  checked: false,
  createdAt: new Date(),
};

/** Make the next db.select() resolve rows via .from().where() (ownership / existing-texts query) */
function mockSelectWhere(rows: unknown[]) {
  vi.mocked(db).select.mockReturnValueOnce({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  } as any);
}

/** Make the next db.select() resolve rows via .from().where().orderBy() (item list query) */
function mockSelectOrdered(rows: unknown[]) {
  vi.mocked(db).select.mockReturnValueOnce({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(rows),
  } as any);
}

/** Make db.insert() return rows via .values().onConflictDoNothing().returning(), capturing values */
function mockInsertReturning(rows: unknown[]) {
  const values = vi.fn().mockReturnThis();
  vi.mocked(db).insert.mockReturnValueOnce({
    values,
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
  } as any);
  return values;
}

/** Make db.update() return rows via .set().where().returning() */
function mockUpdateReturning(rows: unknown[]) {
  vi.mocked(db).update.mockReturnValueOnce({
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
  } as any);
}

/** Make db.delete() return rows via .where().returning() */
function mockDeleteReturning(rows: unknown[]) {
  vi.mocked(db).delete.mockReturnValueOnce({
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
  } as any);
}

// ---------------------------------------------------------------------------
// getShoppingListItems
// ---------------------------------------------------------------------------

describe('getShoppingListItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty list when the menu is not the user's", async () => {
    mockSelectWhere([ACCESS_DENIED_ROW]);
    const result = await getShoppingListItems('user-get-1', 'menu-abc');
    expect(result).toEqual([]);
    // Only the ownership query ran — the item query was never issued
    expect(vi.mocked(db).select).toHaveBeenCalledTimes(1);
  });

  it('returns items when the menu belongs to the user', async () => {
    mockSelectWhere([ACCESS_GRANTED_ROW]);
    mockSelectOrdered([ITEM_ROW]);
    const result = await getShoppingListItems('user-get-2', 'menu-abc');
    expect(result).toEqual([ITEM_ROW]);
  });
});

// ---------------------------------------------------------------------------
// addShoppingListItems
// ---------------------------------------------------------------------------

describe('addShoppingListItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the menu is not the user's", async () => {
    mockSelectWhere([ACCESS_DENIED_ROW]);
    const result = await addShoppingListItems('user-add-1', 'menu-abc', ['milk']);
    expect(result).toBeNull();
    expect(vi.mocked(db).insert).not.toHaveBeenCalled();
  });

  it('trims input and skips blanks and case-insensitive duplicates', async () => {
    mockSelectWhere([ACCESS_GRANTED_ROW]);
    mockSelectWhere([{ text: 'Milk' }]); // existing item on the list
    const values = mockInsertReturning([{ ...ITEM_ROW, text: 'eggs' }]);

    const result = await addShoppingListItems('user-add-2', 'menu-abc', [
      '  eggs  ', // trimmed + inserted
      'milk', // duplicate of existing 'Milk'
      'EGGS', // duplicate of 'eggs' earlier in the same call
      '   ', // blank
    ]);

    expect(values).toHaveBeenCalledWith([{ menuId: 'menu-abc', userId: 'user-add-2', text: 'eggs' }]);
    expect(result).toEqual([{ ...ITEM_ROW, text: 'eggs' }]);
  });

  it('returns empty list without inserting when every text is a duplicate', async () => {
    mockSelectWhere([ACCESS_GRANTED_ROW]);
    mockSelectWhere([{ text: 'milk' }]);

    const result = await addShoppingListItems('user-add-3', 'menu-abc', ['Milk', ' MILK ']);

    expect(result).toEqual([]);
    expect(vi.mocked(db).insert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// setShoppingListItemChecked
// ---------------------------------------------------------------------------

describe('setShoppingListItemChecked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the updated item', async () => {
    mockUpdateReturning([{ ...ITEM_ROW, checked: true }]);
    const result = await setShoppingListItemChecked('user-1', 1, true);
    expect(result).toEqual({ ...ITEM_ROW, checked: true });
  });

  it("returns null when the item does not exist or is not the user's", async () => {
    mockUpdateReturning([]);
    const result = await setShoppingListItemChecked('user-1', 999, true);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deleteShoppingListItem
// ---------------------------------------------------------------------------

describe('deleteShoppingListItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when a row was removed', async () => {
    mockDeleteReturning([{ id: 1 }]);
    expect(await deleteShoppingListItem('user-1', 1)).toBe(true);
  });

  it('returns false when nothing matched', async () => {
    mockDeleteReturning([]);
    expect(await deleteShoppingListItem('user-1', 999)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deleteAllUserShoppingListItems
// ---------------------------------------------------------------------------

describe('deleteAllUserShoppingListItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the number of deleted rows', async () => {
    mockDeleteReturning([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(await deleteAllUserShoppingListItems('user-1')).toBe(3);
  });
});
