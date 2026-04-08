#!/usr/bin/env node
const PORT = process.env['PORT'] ?? 3000;
fetch(`http://localhost:${PORT}/api/auth/providers`)
  .then((r) => process.exit(r.ok ? 0 : 1))
  .catch(() => process.exit(1));
