-- Custom SQL migration file, put your code below! --

-- LoanAccountDetails.startDate was renamed to firstPaymentDate (it anchors the payment
-- schedule, not necessarily when the loan was contracted). Rename the same JSONB key on
-- existing loan accounts so their amortization schedule keeps resolving after the app update.
UPDATE "finance_accounts"
SET "details" = ("details" - 'startDate') || jsonb_build_object('firstPaymentDate', "details" -> 'startDate')
WHERE "type" = 'loan' AND "details" ? 'startDate';