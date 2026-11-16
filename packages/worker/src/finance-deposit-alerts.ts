import {
  buildFinanceDepositAlertsHtml,
  findUserById,
  generateUnsubscribeToken,
  getDepositAlertsForBudget,
  getSubscribedUserIds,
  getUserActiveBudget,
  sendEmail,
} from '@my-hub/shared/services';
import { logger } from '@my-hub/shared/utils';
import { workerEnvConfig } from './config/env';

/**
 * Emails subscribed users when a deposit rule fires today: maturity in 14 days, or an expected interest
 * payout that became overdue. Sends nothing when no rule fires — alerts only, no routine digest.
 */
export async function sendFinanceDepositAlerts(): Promise<void> {
  const userIds = await getSubscribedUserIds('finance_deposit_alerts');
  logger.info(`[finance-deposit-alerts] Checking ${userIds.length} subscribed user(s)`);

  let sent = 0;
  for (const userId of userIds) {
    try {
      const [user, budget] = await Promise.all([findUserById(userId), getUserActiveBudget(userId)]);
      if (!user || !budget) continue;

      const groups = await getDepositAlertsForBudget(userId, budget.id);
      if (groups.length === 0) continue;

      const token = await generateUnsubscribeToken(userId, 'finance_deposit_alerts');
      const html = buildFinanceDepositAlertsHtml({
        groups,
        urls: {
          unsubscribeUrl: `${workerEnvConfig.HUB_URL}/api/unsubscribe?token=${token}`,
          viewInAppUrl: `${workerEnvConfig.HUB_URL}/finances/accounts`,
        },
      });
      await sendEmail({ to: user.email, subject: 'Deposit alert', html });
      sent++;
    } catch (err) {
      logger.error(`[finance-deposit-alerts] Failed for user ${userId}:`, err);
    }
  }

  logger.info(`[finance-deposit-alerts] Done — sent: ${sent}`);
}
