ALTER TYPE "mcp_server" ADD VALUE 'finances';--> statement-breakpoint
ALTER TABLE "finance_accounts" ALTER COLUMN "opening_balance" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "finance_accounts" ALTER COLUMN "balance" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "finance_transactions" ALTER COLUMN "exchange_rate" SET DEFAULT 1;