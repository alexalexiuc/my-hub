# shared utils

Pure helpers only: no DB, no network, no env (except `getEnvVar` itself). Each file has a `.test.ts`.

- List what exists before writing one: `pnpm inventory packages/shared/src/utils --docs`.
- Most-used: `omitUndefined` / `omitNullish` / `trimOrNull` / `getEnvVar` (`objects.ts`), `logger`,
  `UserInputError` (`errors.ts`), date strings in the user's timezone (`currentDateString(tz)`,
  `dateStringDaysAgo`, `shiftDateStr`, `shiftMonthStr`, `monthEndStr`, `buildMonthGridDays` in `dates.ts`).
- Domain maths that has a single owner — reuse it, never re-derive: `isLiabilityAccount` (finances),
  `dayCalorieTargets` / `profileToTargets` (calories), `weight-goal.ts` trend + projection, `vacation.ts` engine,
  `computeContributionCadence` (portfolio).
- File header: a short JSDoc block naming the file's exports. Keep each export's own JSDoc first sentence
  meaningful — `pnpm inventory --docs` prints it.
