#!/usr/bin/env node
const PORT = process.env['PORT'] ?? 3001;
fetch(`http://localhost:${PORT}/api/health`)
  .then((r) => process.exit(r.ok ? 0 : 1))
  .catch(() => process.exit(1));
