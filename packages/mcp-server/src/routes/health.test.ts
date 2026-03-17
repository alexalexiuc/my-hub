import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkDatabaseConnection } from '@my-hub/shared/services';

vi.mock('@my-hub/shared/services', () => ({
  checkDatabaseConnection: vi.fn(),
}));

import { buildApp } from '../index';

describe('health route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 200 with app and database status ok', async () => {
    vi.mocked(checkDatabaseConnection).mockResolvedValue(true);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body) as {
      status: string;
      database: { status: string };
    };

    expect(body.status).toBe('ok');
    expect(body.database.status).toBe('ok');
  });

  it('returns 503 with degraded status when database is unavailable', async () => {
    vi.mocked(checkDatabaseConnection).mockResolvedValue(false);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(503);

    const body = JSON.parse(res.body) as {
      status: string;
      database: { status: string };
    };

    expect(body.status).toBe('degraded');
    expect(body.database.status).toBe('error');
  });
});
