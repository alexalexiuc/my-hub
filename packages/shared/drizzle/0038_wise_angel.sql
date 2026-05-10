ALTER TABLE "finance_payees" RENAME COLUMN "alias" TO "aliases";--> statement-breakpoint
ALTER TABLE "finance_payees" ALTER COLUMN "aliases" SET DATA TYPE jsonb USING (
	CASE
		WHEN "aliases" IS NULL OR btrim("aliases") = '' THEN '[]'::jsonb
		ELSE to_jsonb(ARRAY["aliases"])
	END
);--> statement-breakpoint
ALTER TABLE "finance_payees" ALTER COLUMN "aliases" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "finance_payees" ALTER COLUMN "aliases" SET NOT NULL;
