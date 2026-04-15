function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const HUB_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1f3a" />
      <stop offset="100%" stop-color="#0f766e" />
    </linearGradient>
    <clipPath id="rounded">
      <rect x="2" y="2" width="60" height="60" rx="12" ry="12" />
    </clipPath>
  </defs>
  <g clip-path="url(#rounded)">
    <rect x="2" y="2" width="60" height="60" rx="12" ry="12" fill="url(#g)" />
    <text x="32" y="33" text-anchor="middle" dominant-baseline="middle"
      font-family="Verdana, Geneva, sans-serif" font-size="18" font-weight="700"
      letter-spacing="0.5" fill="#f8fafc">HUB</text>
  </g>
</svg>`;

export function renderConsentPage(params: URLSearchParams, email: string): string {
  const clientId = escapeHtml(params.get('client_id') ?? '');
  const clientName = escapeHtml(params.get('client_name') ?? clientId);
  const hiddenFields = [...params.entries()]
    .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`)
    .join('\n      ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorize — My Hub</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #09090b;
      color: #f4f4f5;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }

    .card {
      width: 100%;
      max-width: 420px;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }

    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 28px;
    }

    .header-text h1 {
      font-size: 1rem;
      font-weight: 600;
      color: #f4f4f5;
    }

    .header-text p {
      font-size: 0.75rem;
      color: #71717a;
      margin-top: 1px;
    }

    .divider {
      height: 1px;
      background: #27272a;
      margin-bottom: 24px;
    }

    .body p {
      font-size: 0.9rem;
      color: #a1a1aa;
      line-height: 1.5;
    }

    .body p strong {
      color: #f4f4f5;
      font-weight: 600;
    }

    .user-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #09090b;
      border: 1px solid #27272a;
      border-radius: 8px;
      padding: 10px 14px;
      margin-top: 20px;
      font-size: 0.8rem;
      color: #a1a1aa;
    }

    .user-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #22c55e;
      flex-shrink: 0;
    }

    .user-pill span {
      color: #e4e4e7;
      font-weight: 500;
    }

    .scope-note {
      margin-top: 16px;
      font-size: 0.78rem;
      color: #52525b;
    }

    .actions {
      display: flex;
      gap: 10px;
      margin-top: 28px;
    }

    button {
      flex: 1;
      padding: 10px 16px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      font-family: inherit;
      transition: background 0.15s, opacity 0.15s;
    }

    button[value="allow"] {
      background: #4f46e5;
      color: #fff;
    }
    button[value="allow"]:hover { background: #6366f1; }

    button[value="deny"] {
      background: #27272a;
      color: #e4e4e7;
      border: 1px solid #3f3f46;
    }
    button[value="deny"]:hover { background: #3f3f46; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      ${HUB_ICON_SVG}
      <div class="header-text">
        <h1>My Hub</h1>
        <p>Authorization request</p>
      </div>
    </div>
    <div class="divider"></div>
    <div class="body">
      <p><strong>${clientName}</strong> is requesting access to your Hub data.</p>
      <div class="user-pill">
        <div class="user-dot"></div>
        Signed in as <span>${escapeHtml(email)}</span>
      </div>
      <p class="scope-note">Access covers all Hub tools: travel, calories, todos, and more.</p>
    </div>
    <form method="POST" action="/api/authorize">
      ${hiddenFields}
      <div class="actions">
        <button type="submit" name="action" value="deny">Deny</button>
        <button type="submit" name="action" value="allow">Allow access</button>
      </div>
    </form>
  </div>
</body>
</html>`;
}
