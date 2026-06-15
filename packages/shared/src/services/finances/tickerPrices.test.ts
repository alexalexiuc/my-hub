import { describe, expect, it } from 'vitest';
import { parseStooqCsv, parseYahooChartResponse } from './tickerPrices';

// 2025-12-04T08:00:00Z and 2025-12-05T08:00:00Z — Xetra-style session timestamps
const TS_DEC_4 = 1764835200;
const TS_DEC_5 = 1764921600;

function yahooPayload(overrides?: Record<string, unknown>) {
  return {
    chart: {
      result: [
        {
          meta: { currency: 'EUR' },
          timestamp: [TS_DEC_4, TS_DEC_5],
          indicators: { quote: [{ close: [14.43, null] }] },
          ...overrides,
        },
      ],
      error: null,
    },
  };
}

describe('parseYahooChartResponse', () => {
  it('parses timestamps to UTC dates and skips null closes', () => {
    const rows = parseYahooChartResponse(yahooPayload(), 'SPYL.DE', 'EUR');
    expect(rows).toEqual([{ symbol: 'SPYL.DE', date: '2025-12-04', close: 14.43, currency: 'EUR', source: 'yahoo' }]);
  });

  it('falls back to the position currency when meta.currency is unsupported', () => {
    const rows = parseYahooChartResponse(yahooPayload({ meta: { currency: 'XYZ' } }), 'SPYL.DE', 'EUR');
    expect(rows[0]!.currency).toBe('EUR');
  });

  it('returns [] when chart.error is set', () => {
    const payload = { chart: { result: null, error: { code: 'Not Found' } } };
    expect(parseYahooChartResponse(payload, 'SPYL.DE', 'EUR')).toEqual([]);
  });

  it('returns [] on malformed payloads', () => {
    expect(parseYahooChartResponse(null, 'SPYL.DE', 'EUR')).toEqual([]);
    expect(parseYahooChartResponse({}, 'SPYL.DE', 'EUR')).toEqual([]);
    expect(parseYahooChartResponse({ chart: { result: [] } }, 'SPYL.DE', 'EUR')).toEqual([]);
  });
});

describe('parseStooqCsv', () => {
  it('parses date and close columns, skipping malformed lines', () => {
    const csv = ['Date,Open,High,Low,Close,Volume', '2025-12-04,14.40,14.50,14.30,14.43,1000', 'garbage', ''].join(
      '\n',
    );
    expect(parseStooqCsv(csv, 'SPYL.DE', 'EUR')).toEqual([
      { symbol: 'SPYL.DE', date: '2025-12-04', close: 14.43, currency: 'EUR', source: 'stooq' },
    ]);
  });

  it('returns [] for No data and HTML bodies', () => {
    expect(parseStooqCsv('No data', 'SPYL.DE', 'EUR')).toEqual([]);
    expect(parseStooqCsv('<html><body>error</body></html>', 'SPYL.DE', 'EUR')).toEqual([]);
    expect(parseStooqCsv('', 'SPYL.DE', 'EUR')).toEqual([]);
  });
});
