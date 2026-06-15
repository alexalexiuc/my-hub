CREATE INDEX "idx_finance_txns_budget_payee_date" ON "finance_transactions" USING btree ("budget_id","payee_id","date");
