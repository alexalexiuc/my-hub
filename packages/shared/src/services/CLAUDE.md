# shared services

- List what a domain already offers before adding a query:
  `pnpm inventory packages/shared/src/services/<domain> --docs`.
- Domain rules live in skills: `finances-domain`, `travel-domain`, `calories-domain`, `vacation-domain`. Small
  domains (users, invites, oauth-clients, logs, notifications, email, s3, measurements, theme preferences): read
  the folder directly.
- One domain per folder, re-exported from its `index.ts` and from `src/services/index.ts`. User-owned tables need
  a `deleteAllUser*` function wired into the Hub's delete-all route.
- JSDoc each export; keep the first sentence a self-contained summary (it is what the inventory prints).
