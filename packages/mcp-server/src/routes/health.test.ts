import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkDatabaseConnection } from '@my-hub/shared/services';
import { getHealthStatus } from './health';

vi.mock('@my-hub/shared/services', () => ({
  checkDatabaseConnection: vi.fn(),
}));

describe('getHealthStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ok status when database connection is healthy', async () => {
    vi.mocked(checkDatabaseConnection).mockResolvedValue(true);

    const status = await getHealthStatus();

    expect(status.status).toBe('ok');
    expect(status.database.status).toBe('ok');
    expect(status.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('returns degraded status when database connection fails', async () => {
    vi.mocked(checkDatabaseConnection).mockResolvedValue(false);

    const status = await getHealthStatus();

    expect(status.status).toBe('degraded');
    expect(status.database.status).toBe('error');
    expect(status.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('calls checkDatabaseConnection exactly once', async () => {
    vi.mocked(checkDatabaseConnection).mockResolvedValue(true);

    await getHealthStatus();

    expect(checkDatabaseConnection).toHaveBeenCalledOnce();
    expect(checkDatabaseConnection).toHaveBeenCalledWith();
  });
});
