# shared package — Agent Guidelines

- **What exists:** `pnpm inventory packages/shared/src/<utils|services/<domain>|constants> --docs` prints every
  export with its JSDoc summary. Check it before writing a helper or a query; a missing general-purpose function
  (string, number, date, array…) belongs in `src/utils/` even if one caller needs it today.
- Domain rules (money model, booking details, goal baselines, the vacation engine) are in the `finances-domain`,
  `travel-domain`, `calories-domain` and `vacation-domain` skills — load the one you are touching.
- Every exported function gets a JSDoc comment (purpose, params, side effects); its first sentence is what
  `pnpm inventory --docs` shows, so make it say what the function is for.
- Other packages compile against `dist/`. After editing `src/`, go through turbo
  (`pnpm exec turbo run typecheck --filter=<pkg>`) or run `pnpm --filter @my-hub/shared build` before a bare
  per-package typecheck/test, or you will chase false type errors.
- Layout: `src/db/schema/<domain>.ts` (export from `schema/index.ts`), `src/constants/<domain>.ts` (export from
  `constants/index.ts`), row types in `src/types/index.ts` (`InferSelectModel`), services in
  `src/services/<domain>/` (export from the domain `index.ts`), pure code + `.test.ts` in `src/utils/`.
- Services validate first, then write in one transaction, and throw a `UserInputError` subclass for user
  mistakes.
