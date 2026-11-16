import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getE2eEnv } from './helpers/env.js';
import { generateToken } from './helpers/token.js';
import { createMcpClient, parseToolResult, type McpClient } from './helpers/mcp-client.js';

interface DepositSummary {
  maturityDate: string;
  expectedNetInterest: number;
  interestReceivedToDate: number;
  nextPayoutDate: string | null;
}

interface AddDepositResult {
  id: number;
  type: string;
  fundingTransactionId: number;
  depositSummary: DepositSummary;
  schedule: { date: string; gross: number; tax: number; net: number }[];
}

interface ListContextResult {
  accounts: { id: number; type: string; balance: number; depositSummary?: DepositSummary }[];
}

/**
 * E2e: deposit lifecycle — open (funding transfer) → record interest → list_context summary → close.
 * Accounts are created with a unique run id and archived at the end (closing archives the deposit).
 */
describe('finances — deposit lifecycle', () => {
  let client: McpClient;
  const runId = Date.now().toString(36);
  let sourceId: number;
  let payoutId: number;
  let depositId: number;

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    client = await createMcpClient(baseUrl, '/finances/mcp', await generateToken());

    const source = parseToolResult<{ id: number }>(
      await client.callTool({
        name: 'finances_upsert_account',
        arguments: {
          name: `[e2e:${runId}] Deposit source`,
          type: 'bank',
          currency: 'MDL',
          openingBalance: 300_000,
          openingDate: '2099-01-01',
        },
      }),
    );
    sourceId = source.id;
    const payout = parseToolResult<{ id: number }>(
      await client.callTool({
        name: 'finances_upsert_account',
        arguments: { name: `[e2e:${runId}] Deposit payout`, type: 'bank', currency: 'MDL' },
      }),
    );
    payoutId = payout.id;
  });

  afterAll(async () => {
    for (const id of [sourceId, payoutId]) {
      if (id) await client.callTool({ name: 'finances_upsert_account', arguments: { id, archived: true } });
    }
    await client.close();
  });

  it('opens a deposit: funding is a transfer and the summary matches the MICB example', async () => {
    const data = parseToolResult<AddDepositResult>(
      await client.callTool({
        name: 'finances_add_deposit',
        arguments: {
          name: `[e2e:${runId}] MICB Maestro`,
          currency: 'MDL',
          institution: 'MICB',
          principal: 200_000,
          interestRate: 8,
          startDate: '2099-01-02',
          termMonths: 12,
          payout: 'monthly',
          payoutAccountId: payoutId,
          sourceAccountId: sourceId,
        },
      }),
    );
    depositId = data.id;

    expect(data.type).toBe('deposit');
    expect(data.depositSummary.expectedNetInterest).toBe(15_040);
    expect(data.depositSummary.maturityDate).toBe('2100-01-02');
    expect(data.schedule).toHaveLength(12);

    const ctx = parseToolResult<ListContextResult>(
      await client.callTool({ name: 'finances_list_context', arguments: {} }),
    );
    expect(ctx.accounts.find(a => a.id === sourceId)!.balance).toBe(100_000);
    const deposit = ctx.accounts.find(a => a.id === depositId)!;
    expect(deposit.balance).toBe(200_000);
    expect(deposit.depositSummary?.expectedNetInterest).toBe(15_040);
  });

  it('does not allow creating a deposit through upsert_account', async () => {
    const result = await client.callTool({
      name: 'finances_upsert_account',
      arguments: { name: `[e2e:${runId}] nope`, type: 'deposit' },
    });
    expect(result.isError).toBe(true);
  });

  it('records the next scheduled interest payout as net income in the payout account', async () => {
    const data = parseToolResult<{ net: number; tax: number; gross: number; depositSummary: DepositSummary }>(
      await client.callTool({
        name: 'finances_record_deposit_interest',
        arguments: { depositAccountId: depositId, date: '2099-02-02' },
      }),
    );
    expect(data.net).toBe(1253.33);
    expect(data.tax).toBe(80);
    expect(data.depositSummary.interestReceivedToDate).toBe(1253.33);

    const ctx = parseToolResult<ListContextResult>(
      await client.callTool({ name: 'finances_list_context', arguments: {} }),
    );
    expect(ctx.accounts.find(a => a.id === payoutId)!.balance).toBe(1253.33);
  });

  it('closes the deposit at maturity: principal returns and the deposit leaves active accounts', async () => {
    const closed = parseToolResult<{ status: string; archived: boolean; returnedAmount: number }>(
      await client.callTool({
        name: 'finances_close_deposit',
        arguments: { depositAccountId: depositId, reason: 'matured', date: '2100-01-02' },
      }),
    );
    expect(closed).toMatchObject({ status: 'matured', archived: true, returnedAmount: 200_000 });

    const ctx = parseToolResult<ListContextResult>(
      await client.callTool({ name: 'finances_list_context', arguments: {} }),
    );
    expect(ctx.accounts.find(a => a.id === depositId)).toBeUndefined();
    expect(ctx.accounts.find(a => a.id === payoutId)!.balance).toBe(201_253.33);
  });
});
