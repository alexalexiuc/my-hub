import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getE2eEnv } from './helpers/env.js';
import { generateToken } from './helpers/token.js';
import { createMcpClient, parseToolResult, type McpClient } from './helpers/mcp-client.js';

interface AccountEntry {
  id: number;
  name: string;
  type: string;
  currency: string;
  balance: number;
  archived: boolean;
}

interface CategoryEntry {
  id: number;
  name: string;
  group: string | null;
  monthlyTarget: number | null;
}

interface GroupEntry {
  id: number;
  name: string;
}

interface PayeeEntry {
  id: number;
  name: string;
  aliases: string[];
}

interface ListContextResult {
  accounts: AccountEntry[];
  categories: CategoryEntry[];
  groups: GroupEntry[];
  payees: PayeeEntry[];
}

interface UpsertAccountResult {
  id: number;
  name: string;
  type: string;
  currency: string;
  balance: number;
  archived: boolean;
  openingTransaction?: {
    transactionId: number;
    type: string;
    amount: number;
    date: string;
    balanceAfter: number | null;
  };
}

interface UpsertCategoryResult {
  id: number;
  name: string;
  group: string | null;
  monthlyTarget: number | null;
}

interface MergePayeesResult {
  mergedCount: number;
  targetId: number;
  canonicalName: string;
}

interface UpsertPayeeResult {
  message: string;
  payeeId: number;
  name: string;
}

interface AddTransactionResult {
  index: number;
  transactionId?: number;
  fromAccountBalanceAfter?: number;
  resolvedAccount?: string;
  resolvedPayee?: string | null;
  error?: string;
}

interface AddTransactionsResult {
  results: AddTransactionResult[];
}

interface PayeeNotFoundResult {
  error: {
    code: string;
    message: string;
    normalizedName: string;
    requirePayeeCreation: boolean;
  };
}

/**
 * E2e tests for the finances MCP context and management tools.
 *
 * These tests exercise the full lifecycle:
 *   list_context → upsert_account → upsert_category → merge_payees
 *
 * A unique run ID is used so test artefacts can be identified and cleaned up
 * without relying on a test-only database.
 */
describe.sequential('finances — list_context', () => {
  let client: McpClient;

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    const token = await generateToken();
    client = await createMcpClient(baseUrl, '/finances/mcp', token);
  });

  afterAll(async () => {
    await client.close();
  });

  it('returns accounts, categories, groups, and payees arrays', async () => {
    const result = await client.callTool({
      name: 'finances_list_context',
      arguments: {},
    });

    const data = parseToolResult<ListContextResult>(result);

    expect(Array.isArray(data.accounts)).toBe(true);
    expect(Array.isArray(data.categories)).toBe(true);
    expect(Array.isArray(data.groups)).toBe(true);
    expect(Array.isArray(data.payees)).toBe(true);
  });

  it('account entries have required fields', async () => {
    const result = await client.callTool({
      name: 'finances_list_context',
      arguments: {},
    });

    const data = parseToolResult<ListContextResult>(result);

    // Finances must have at least one account to be useful
    if (data.accounts.length > 0) {
      const account = data.accounts[0]!;
      expect(typeof account.id).toBe('number');
      expect(typeof account.name).toBe('string');
      expect(typeof account.type).toBe('string');
      expect(typeof account.currency).toBe('string');
      expect(typeof account.balance).toBe('number');
      expect(typeof account.archived).toBe('boolean');
    }
  });

  it('category entries have required fields when present', async () => {
    const result = await client.callTool({
      name: 'finances_list_context',
      arguments: {},
    });

    const data = parseToolResult<ListContextResult>(result);

    if (data.categories.length > 0) {
      const category = data.categories[0]!;
      expect(typeof category.id).toBe('number');
      expect(typeof category.name).toBe('string');
      // group may be null (ungrouped) or a string
      expect(category.group === null || typeof category.group === 'string').toBe(true);
    }
  });

  it('payee entries have required fields when present', async () => {
    const result = await client.callTool({
      name: 'finances_list_context',
      arguments: {},
    });

    const data = parseToolResult<ListContextResult>(result);

    if (data.payees.length > 0) {
      const payee = data.payees[0]!;
      expect(typeof payee.id).toBe('number');
      expect(typeof payee.name).toBe('string');
      expect(Array.isArray(payee.aliases)).toBe(true);
    }
  });
});

describe.sequential('finances — upsert_account lifecycle', () => {
  let client: McpClient;
  let createdAccountId: number | undefined;
  const runId = Date.now().toString(36);
  const testAccountName = `[e2e:${runId}] Test Cash Account`;

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    const token = await generateToken();
    client = await createMcpClient(baseUrl, '/finances/mcp', token);
  });

  afterAll(async () => {
    await client.close();
  });

  it('creates a new cash account', async () => {
    const result = await client.callTool({
      name: 'finances_upsert_account',
      arguments: {
        name: testAccountName,
        type: 'cash',
        currency: 'MDL',
      },
    });

    const data = parseToolResult<UpsertAccountResult>(result);

    expect(typeof data.id).toBe('number');
    expect(data.name).toBe(testAccountName);
    expect(data.type).toBe('cash');
    expect(data.currency).toBe('MDL');
    expect(data.balance).toBe(0);
    expect(data.archived).toBe(false);

    createdAccountId = data.id;
  });

  it('creates account with opening balance', async () => {
    const result = await client.callTool({
      name: 'finances_upsert_account',
      arguments: {
        name: `[e2e:${runId}] Bank With Balance`,
        type: 'bank',
        currency: 'MDL',
        openingBalance: 5000,
        openingDate: '2099-01-01',
      },
    });

    const data = parseToolResult<UpsertAccountResult>(result);

    expect(typeof data.id).toBe('number');
    expect(data.balance).toBe(5000);
    expect(data.openingTransaction).toBeDefined();
    expect(data.openingTransaction!.type).toBe('income');
    expect(data.openingTransaction!.amount).toBe(5000);

    // Cleanup this account by archiving
    await client.callTool({
      name: 'finances_upsert_account',
      arguments: { id: data.id, archived: true },
    });
  });

  it('updates the account name', async () => {
    expect(createdAccountId).toBeDefined();

    const updatedName = `[e2e:${runId}] Updated Cash Account`;
    const result = await client.callTool({
      name: 'finances_upsert_account',
      arguments: {
        id: createdAccountId,
        name: updatedName,
      },
    });

    const data = parseToolResult<UpsertAccountResult>(result);
    expect(data.id).toBe(createdAccountId);
    expect(data.name).toBe(updatedName);
  });

  it('archives the account', async () => {
    expect(createdAccountId).toBeDefined();

    const result = await client.callTool({
      name: 'finances_upsert_account',
      arguments: {
        id: createdAccountId,
        archived: true,
      },
    });

    const data = parseToolResult<UpsertAccountResult>(result);
    expect(data.archived).toBe(true);
  });

  it('returns error for non-existent account id', async () => {
    const result = await client.callTool({
      name: 'finances_upsert_account',
      arguments: {
        id: 999999999,
        name: 'Ghost',
      },
    });

    expect(result.isError).toBe(true);
  });

  it('returns error when creating without required fields', async () => {
    const result = await client.callTool({
      name: 'finances_upsert_account',
      arguments: {
        currency: 'MDL',
        // Missing name and type
      },
    });

    expect(result.isError).toBe(true);
  });
});

describe.sequential('finances — upsert_category lifecycle', () => {
  let client: McpClient;
  let createdCategoryId: number | undefined;
  let testGroupName: string | undefined;
  const runId = Date.now().toString(36);
  const testCategoryName = `[e2e:${runId}] Test Category`;

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    const token = await generateToken();
    client = await createMcpClient(baseUrl, '/finances/mcp', token);

    // Find a group name to use for testing (if any exist)
    const contextResult = await client.callTool({
      name: 'finances_list_context',
      arguments: {},
    });
    const context = parseToolResult<ListContextResult>(contextResult);
    testGroupName = context.groups[0]?.name;
  });

  afterAll(async () => {
    await client.close();
  });

  it('creates a new ungrouped category', async () => {
    const result = await client.callTool({
      name: 'finances_upsert_category',
      arguments: {
        name: testCategoryName,
        icon: 'tag',
        color: '#6ee7b7',
      },
    });

    const data = parseToolResult<UpsertCategoryResult>(result);

    expect(typeof data.id).toBe('number');
    expect(data.name).toBe(testCategoryName);
    expect(data.group).toBeNull();
    expect(data.monthlyTarget).toBeNull();

    createdCategoryId = data.id;
  });

  it('updates the category with a monthly target', async () => {
    expect(createdCategoryId).toBeDefined();

    const result = await client.callTool({
      name: 'finances_upsert_category',
      arguments: {
        id: createdCategoryId,
        monthlyTarget: 3000,
        icon: 'tag',
        color: '#6ee7b7',
      },
    });

    const data = parseToolResult<UpsertCategoryResult>(result);
    expect(data.id).toBe(createdCategoryId);
    expect(data.monthlyTarget).toBe(3000);
  });

  it('removes the monthly target by setting it to null', async () => {
    expect(createdCategoryId).toBeDefined();

    const result = await client.callTool({
      name: 'finances_upsert_category',
      arguments: {
        id: createdCategoryId,
        monthlyTarget: null,
        icon: 'tag',
        color: '#6ee7b7',
      },
    });

    const data = parseToolResult<UpsertCategoryResult>(result);
    expect(data.monthlyTarget).toBeNull();
  });

  it('assigns a group when a group exists', async () => {
    if (!testGroupName) {
      console.log('No groups found, skipping group assignment test');
      return;
    }

    expect(createdCategoryId).toBeDefined();

    const result = await client.callTool({
      name: 'finances_upsert_category',
      arguments: {
        id: createdCategoryId,
        groupName: testGroupName,
        icon: 'tag',
        color: '#6ee7b7',
      },
    });

    const data = parseToolResult<UpsertCategoryResult>(result);
    expect(data.group).toBe(testGroupName);
  });

  it('returns error for non-existent category id', async () => {
    const result = await client.callTool({
      name: 'finances_upsert_category',
      arguments: {
        id: 999999999,
        name: 'Ghost Category',
      },
    });

    expect(result.isError).toBe(true);
  });

  it('creates a new group when group name does not exist', async () => {
    expect(createdCategoryId).toBeDefined();

    const newGroupName = `[e2e:${runId}] Non-Existent Group`;
    const result = await client.callTool({
      name: 'finances_upsert_category',
      arguments: {
        id: createdCategoryId,
        groupName: newGroupName,
        icon: 'tag',
        color: '#6ee7b7',
      },
    });

    const data = parseToolResult<UpsertCategoryResult>(result);
    expect(data.group).toBe(newGroupName);
  });
});

describe.sequential('finances — merge_payees', () => {
  let client: McpClient;

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    const token = await generateToken();
    client = await createMcpClient(baseUrl, '/finances/mcp', token);
  });

  afterAll(async () => {
    await client.close();
  });

  it('returns error when targetId is in sourceIds', async () => {
    const result = await client.callTool({
      name: 'finances_merge_payees',
      arguments: {
        targetId: 1,
        sourceIds: [1, 2],
      },
    });

    expect(result.isError).toBe(true);
  });

  it('returns error when payee ids do not exist', async () => {
    const result = await client.callTool({
      name: 'finances_merge_payees',
      arguments: {
        targetId: 999999998,
        sourceIds: [999999999],
      },
    });

    expect(result.isError).toBe(true);
  });

  it('merges two payees successfully when they exist', async () => {
    const runId = Date.now().toString(36);
    const canonicalName = `[e2e:${runId}] Merged Payee`;

    const contextResult = await client.callTool({
      name: 'finances_list_context',
      arguments: {},
    });
    const context = parseToolResult<ListContextResult>(contextResult);

    if (context.payees.length < 2) {
      console.log('Not enough payees to run merge test, skipping');
      return;
    }

    const target = context.payees[0]!;
    const source = context.payees[1]!;

    const result = await client.callTool({
      name: 'finances_merge_payees',
      arguments: {
        targetId: target.id,
        sourceIds: [source.id],
        canonicalName,
      },
    });

    const data = parseToolResult<MergePayeesResult>(result);

    expect(data.targetId).toBe(target.id);
    expect(typeof data.mergedCount).toBe('number');
    expect(data.canonicalName).toBe(canonicalName);

    const afterContextResult = await client.callTool({
      name: 'finances_list_context',
      arguments: {},
    });
    const afterContext = parseToolResult<ListContextResult>(afterContextResult);
    const remainingIds = new Set(afterContext.payees.map(p => p.id));

    expect(remainingIds.has(source.id)).toBe(false);
  });
});

describe.sequential('finances — upsert_payee lifecycle', () => {
  let client: McpClient;
  const runId = Date.now().toString(36);
  const testPayeeName = `[e2e:${runId}] Test Payee`;

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    const token = await generateToken();
    client = await createMcpClient(baseUrl, '/finances/mcp', token);
  });

  afterAll(async () => {
    await client.close();
  });

  it('creates a new payee', async () => {
    const result = await client.callTool({
      name: 'finances_upsert_payee',
      arguments: { name: testPayeeName },
    });

    const data = parseToolResult<UpsertPayeeResult>(result);

    expect(typeof data.payeeId).toBe('number');
    expect(data.name).toBe(testPayeeName);
    expect(data.message).toContain('created');
  });

  it('creates a new payee with an alias', async () => {
    const nameWithAlias = `[e2e:${runId}] Payee With Alias`;
    const alias = `[e2e:${runId}] Alias Name`;

    const result = await client.callTool({
      name: 'finances_upsert_payee',
      arguments: { name: nameWithAlias, alias },
    });

    const data = parseToolResult<UpsertPayeeResult>(result);

    expect(typeof data.payeeId).toBe('number');
    expect(data.name).toBe(nameWithAlias);
    expect(data.message).toContain('created');
    expect(data.message).toContain(alias);
  });

  it('returns existing payee without error when name already exists', async () => {
    const result = await client.callTool({
      name: 'finances_upsert_payee',
      arguments: { name: testPayeeName },
    });

    const data = parseToolResult<UpsertPayeeResult>(result);

    expect(data.name).toBe(testPayeeName);
    expect(data.message).toContain('already exists');
  });

  it('adds a new alias to an existing payee', async () => {
    const alias = `[e2e:${runId}] New Alias`;

    const result = await client.callTool({
      name: 'finances_upsert_payee',
      arguments: { name: testPayeeName, alias },
    });

    const data = parseToolResult<UpsertPayeeResult>(result);

    expect(data.name).toBe(testPayeeName);
    expect(data.message).toContain('already exists');
    expect(data.message).toContain(alias);
    expect(data.message).toContain('added');
  });

  it('does not duplicate an alias already present on the payee', async () => {
    const alias = `[e2e:${runId}] New Alias`;

    const result = await client.callTool({
      name: 'finances_upsert_payee',
      arguments: { name: testPayeeName, alias },
    });

    const data = parseToolResult<UpsertPayeeResult>(result);

    expect(data.name).toBe(testPayeeName);
    expect(data.message).toContain('already present');
  });
});

describe.sequential('finances — add_transactions with createPayee flag', () => {
  let client: McpClient;
  let testAccountId: number | undefined;
  let createdTransactionId: number | undefined;
  const runId = Date.now().toString(36);
  const newPayeeName = `[e2e:${runId}] Auto-Created Payee`;

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    const token = await generateToken();
    client = await createMcpClient(baseUrl, '/finances/mcp', token);

    const contextResult = await client.callTool({
      name: 'finances_list_context',
      arguments: {},
    });
    const context = parseToolResult<ListContextResult>(contextResult);
    testAccountId = context.accounts[0]?.id;
  });

  afterAll(async () => {
    if (createdTransactionId !== undefined) {
      await client.callTool({
        name: 'finances_delete_transaction',
        arguments: { transactionId: createdTransactionId },
      });
    }
    await client.close();
  });

  it('returns payee_not_found error when payee is unknown and createPayee is false', async () => {
    if (!testAccountId) {
      console.log('No accounts found, skipping test');
      return;
    }

    const result = await client.callTool({
      name: 'finances_add_transactions',
      arguments: {
        createPayee: false,
        transactions: [
          {
            type: 'expense',
            amount: 1,
            accountId: testAccountId,
            payeeName: newPayeeName,
            notes: `[e2e:${runId}] should fail`,
            date: '2099-01-01',
          },
        ],
      },
    });

    const data = parseToolResult<PayeeNotFoundResult>(result);

    expect(data.error.code).toBe('payee_not_found');
    expect(data.error.requirePayeeCreation).toBe(true);
  });

  it('auto-creates payee and adds transaction when createPayee is true', async () => {
    if (!testAccountId) {
      console.log('No accounts found, skipping test');
      return;
    }

    const result = await client.callTool({
      name: 'finances_add_transactions',
      arguments: {
        createPayee: true,
        transactions: [
          {
            type: 'expense',
            amount: 1,
            accountId: testAccountId,
            payeeName: newPayeeName,
            notes: `[e2e:${runId}] auto-create payee`,
            date: '2099-01-01',
          },
        ],
      },
    });

    const data = parseToolResult<AddTransactionsResult>(result);

    expect(Array.isArray(data.results)).toBe(true);
    expect(data.results).toHaveLength(1);

    const txResult = data.results[0]!;
    expect(txResult.error).toBeUndefined();
    expect(typeof txResult.transactionId).toBe('number');
    expect(txResult.resolvedPayee).toBe(newPayeeName);

    createdTransactionId = txResult.transactionId;
  });

  it('payee created by createPayee flag appears in list_context', async () => {
    const contextResult = await client.callTool({
      name: 'finances_list_context',
      arguments: {},
    });
    const context = parseToolResult<ListContextResult>(contextResult);
    const found = context.payees.find(p => p.name === newPayeeName);

    expect(found).toBeDefined();
  });
});
