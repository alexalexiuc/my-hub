import { ensureTickerPriceHistory, getActivePortfolioSymbols } from '@my-hub/shared/services';
import { logger } from '@my-hub/shared/utils';

/**
 * Keeps the EOD price cache current for every ticker used by any portfolio.
 *
 * `ensureTickerPriceHistory` only fetches the missing head/tail of each
 * symbol's range, so weekends and already-current symbols cost nothing, and
 * missed runs/holidays self-heal on the next pass.
 */
export async function syncTickerPrices(): Promise<void> {
  const symbols = await getActivePortfolioSymbols();
  if (symbols.length === 0) return;

  logger.info(`[worker] Syncing EOD prices for ${symbols.length} symbol(s)...`);

  for (const s of symbols) {
    // throttle — be gentle with the unofficial Yahoo endpoint
    await new Promise(res => setTimeout(res, 1500));
    if (!s.firstBuyDate) continue; // position exists but has no buys yet — nothing to backfill
    try {
      await ensureTickerPriceHistory(s, s.firstBuyDate);
      logger.info(`[worker] Synced ${s.yahooSymbol}`);
    } catch (err) {
      logger.error(`[worker] Error syncing ${s.yahooSymbol}:`, err);
    }
  }
}
