-- Backfill the two new money columns for existing rows. No existing value is changed.
-- reporting_amount: value in the budget default currency, frozen at write time. Existing rows
-- already carry the account→default rate in exchange_rate (1.0 for default-currency accounts),
-- so amount * exchange_rate is exactly what reports summed before.
UPDATE "finance_transactions"
SET "reporting_amount" = round("amount" * "exchange_rate", 4)
WHERE "reporting_amount" IS NULL;
--> statement-breakpoint
-- to_amount: destination leg of transfers, in the destination account's currency. Previously
-- derived on the fly as amount * to_exchange_rate.
UPDATE "finance_transactions"
SET "to_amount" = round("amount" * COALESCE("to_exchange_rate", 1), 4)
WHERE "type" = 'transfer' AND "to_account_id" IS NOT NULL AND "to_amount" IS NULL;
