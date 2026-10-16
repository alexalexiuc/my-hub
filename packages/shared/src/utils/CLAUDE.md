# shared utils

Pure helpers only: no DB, no network, no env (except `getEnvVar` itself). Each file has a `.test.ts`.

- List what exists before writing one: `pnpm inventory packages/shared/src/utils --docs`.
- Most-used: `omitUndefined` / `omitNullish` / `trimOrNull` / `getEnvVar` (`objects.ts`), `logger`,
  `UserInputError` (`errors.ts`), date strings in the user's timezone (`currentDateString(tz)`,
  `dateStringDaysAgo`, `shiftDateStr`, `shiftMonthStr`, `monthEndStr`, `buildMonthGridDays` in `dates.ts`).
  Monthly schedules: `addMonthsKeepDay` (clamps to month end); `shiftMonthStart` drops the day.
- Displayed numbers: `format.ts` (`formatMoney`, `formatNumber`, `formatSigned`, `formatCompact`) — no local
  `fmt` helpers. Intl rounds 1.45 → "1.5" where `toFixed` gives "1.4"; keep `toFixed` where that output matters.
- Domain maths that has a single owner — reuse it, never re-derive: `isLiabilityAccount` (finances),
  `dayCalorieTargets` / `profileToTargets` (calories), `weight-goal.ts` trend + projection, `vacation.ts` engine,
  `computeContributionCadence` (portfolio).
- File header: a short JSDoc block naming the file's exports. Keep each export's own JSDoc first sentence
  meaningful — `pnpm inventory --docs` prints it.
