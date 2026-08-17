import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getE2eEnv } from './helpers/env.js';
import { generateToken } from './helpers/token.js';
import { createMcpClient, parseToolResult, type McpClient } from './helpers/mcp-client.js';

interface PositionOverview {
  symbol: string;
  units: number;
  costBasis: number;
  fees: number;
  currentValue: number | null;
}

interface GetPortfolioResult {
  exists: boolean;
  positions?: PositionOverview[];
  totals?: { contributed: number; costBasis: number; fees: number };
  recentSupplies?: { id: number; date: string }[];
}

interface UpdatePortfolioResult {
  portfolio: { name: string };
  positions: { symbol: string; targetAllocationPct: number }[];
}

interface RecordSupplyResult {
  supply: { id: number; date: string; totalAmount: number; lines: { symbol: string }[] };
}

/**
 * E2e tests for the portfolio MCP tools. Uses fake Yahoo symbols so no real
 * price fetch succeeds — assertions cover only price-independent math.
 */
describe.sequential('finances — portfolio tools', () => {
  let client: McpClient;
  const runId = Date.now().toString(36);
  const symA = `E2EA${runId}`.slice(0, 12);
  const symB = `E2EB${runId}`.slice(0, 12);
  let supplyId: number | undefined;
  // finances_update_portfolio upserts by symbol rather than replacing the full
  // position set, and the portfolio is a per-budget singleton with no
  // delete-position MCP tool — so positions from previous local e2e runs
  // persist. The sum-to-100 validation runs over the whole merged set in a
  // single call, so leftover symbols must be zeroed out in the *same* call
  // that creates this run's positions (a separate zero-only call would itself
  // sum to 0 and be rejected).
  let staleSymbols: string[] = [];

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    const token = await generateToken();
    client = await createMcpClient(baseUrl, '/finances/mcp', token);

    const existing = parseToolResult<GetPortfolioResult>(
      await client.callTool({ name: 'finances_get_portfolio', arguments: { recentSuppliesLimit: 0 } }),
    );
    staleSymbols = existing.exists ? (existing.positions ?? []).map(p => p.symbol) : [];
  });

  afterAll(async () => {
    if (supplyId !== undefined) {
      try {
        await client.callTool({ name: 'finances_delete_portfolio_supply', arguments: { supplyId } });
      } catch {
        // already deleted
      }
    }
    await client.close();
  });

  it('creates the portfolio with two positions via finances_update_portfolio', async () => {
    const result = await client.callTool({
      name: 'finances_update_portfolio',
      arguments: {
        settings: { expectedAnnualReturnPct: 7, plannedMonthlyContribution: 1000 },
        positions: [
          ...staleSymbols.map(symbol => ({ symbol, targetAllocationPct: 0 })),
          { symbol: symA, yahooSymbol: `${symA}.DE`, targetAllocationPct: 60 },
          { symbol: symB, yahooSymbol: `${symB}.DE`, targetAllocationPct: 40 },
        ],
      },
    });
    const data = parseToolResult<UpdatePortfolioResult>(result);
    const symbols = data.positions.map(p => p.symbol);
    expect(symbols).toContain(symA);
    expect(symbols).toContain(symB);
  });

  it('rejects positions whose targets do not sum to 100', async () => {
    const result = await client.callTool({
      name: 'finances_update_portfolio',
      arguments: {
        positions: [
          { symbol: symA, targetAllocationPct: 50 },
          { symbol: symB, targetAllocationPct: 40 },
        ],
      },
    });
    expect(result.isError).toBe(true);
  });

  it('records a supply event by symbol', async () => {
    const result = await client.callTool({
      name: 'finances_record_portfolio_supply',
      arguments: {
        date: '2099-01-05',
        lines: [
          { symbol: symA, units: 10, pricePerUnit: 50, fee: 3 },
          { symbol: symB, units: 5, pricePerUnit: 40, fee: 1 },
        ],
      },
    });
    const data = parseToolResult<RecordSupplyResult>(result);
    supplyId = data.supply.id;
    expect(data.supply.totalAmount).toBeCloseTo(10 * 50 + 3 + 5 * 40 + 1, 2); // 704
    expect(data.supply.lines.map(l => l.symbol).sort()).toEqual([symA, symB].sort());
  });

  it('rejects an unknown symbol', async () => {
    const result = await client.callTool({
      name: 'finances_record_portfolio_supply',
      arguments: { date: '2099-01-06', lines: [{ symbol: 'NOPE', units: 1, pricePerUnit: 1, fee: 0 }] },
    });
    expect(result.isError).toBe(true);
  });

  it('returns portfolio analytics with correct price-independent math', async () => {
    const result = await client.callTool({ name: 'finances_get_portfolio', arguments: { recentSuppliesLimit: 5 } });
    const data = parseToolResult<GetPortfolioResult>(result);

    expect(data.exists).toBe(true);
    expect(data.totals!.contributed).toBeCloseTo(704, 2);
    expect(data.totals!.costBasis).toBeCloseTo(700, 2); // 500 + 200
    expect(data.totals!.fees).toBeCloseTo(4, 2);

    const a = data.positions!.find(p => p.symbol === symA)!;
    expect(a.units).toBe(10);
    expect(a.costBasis).toBeCloseTo(500, 2);
    // Fake symbol → no cached price → value is null
    expect(a.currentValue).toBeNull();

    expect(data.recentSupplies!.some(s => s.id === supplyId)).toBe(true);
  });

  it('deletes the supply event', async () => {
    const result = await client.callTool({
      name: 'finances_delete_portfolio_supply',
      arguments: { supplyId },
    });
    const data = parseToolResult<{ deleted: boolean }>(result);
    expect(data.deleted).toBe(true);
    supplyId = undefined;

    const after = parseToolResult<GetPortfolioResult>(
      await client.callTool({ name: 'finances_get_portfolio', arguments: { recentSuppliesLimit: 5 } }),
    );
    expect(after.totals!.contributed).toBeCloseTo(0, 2);
  });
});
