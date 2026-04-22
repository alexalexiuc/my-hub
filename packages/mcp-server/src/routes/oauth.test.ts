import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { AuthCodePayload, JWTPayload } from '@my-hub/shared/auth';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that trigger the module
// ---------------------------------------------------------------------------

vi.mock('@my-hub/shared/services', () => ({
  findOAuthClient: vi.fn(),
  createOAuthClient: vi.fn(),
  bindOAuthClientToUser: vi.fn(),
  verifyClientSecret: vi.fn(),
  ensureAllMcpServers: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  createRefreshToken: vi.fn(),
  findRefreshToken: vi.fn(),
  deleteRefreshToken: vi.fn(),
}));

vi.mock('@my-hub/shared/auth', () => ({
  signToken: vi.fn(),
  verifyToken: vi.fn(),
  verifyPkceS256: vi.fn(),
}));

vi.mock('../config/env.js', () => ({
  envConfig: { HUB_URL: 'http://hub.test' },
}));

// ---------------------------------------------------------------------------
// Imports after mocking
// ---------------------------------------------------------------------------

import {
  findOAuthClient,
  verifyClientSecret,
  findUserById,
  createRefreshToken,
  findRefreshToken,
  deleteRefreshToken,
  DecryptedOAuthClient,
} from '@my-hub/shared/services';
import { signToken, verifyToken, verifyPkceS256 } from '@my-hub/shared/auth';
import { oauthRoutes } from './oauth';
import { OAuthRefreshToken, User } from '@my-hub/shared/types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const MOCK_CLIENT: DecryptedOAuthClient = {
  id: 1,
  clientId: 'hub_test1234',
  tokenSigningSecret: 'test-signing-secret',
  userId: 'user-uuid-1',
  clientName: 'Test Client',
  redirectUris: [],
  enabled: true,
  createdAt: new Date(),
};

const MOCK_USER: User = {
  id: 'user-uuid-1',
  email: 'test@example.com',
  name: 'Test User',
  passwordHash: null,
  googleId: null,
  active: true,
  country: null,
  timezone: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  emailVerified: true,
  failedLoginAttempts: 0,
  blockedAt: null,
};

const MOCK_REFRESH_TOKEN_ROW: OAuthRefreshToken = {
  id: 42,
  clientId: 'hub_test1234',
  userId: 'user-uuid-1',
  tokenHash: 'hashed-token',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  createdAt: new Date(),
};

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(import('@fastify/formbody'));
  await app.register(oauthRoutes, { prefix: '' });
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /token — refresh_token grant', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('issues a new access token and rotated refresh token for a valid refresh token', async () => {
    vi.mocked(findOAuthClient).mockResolvedValue(MOCK_CLIENT);
    vi.mocked(verifyClientSecret).mockResolvedValue(true);
    vi.mocked(findRefreshToken).mockResolvedValue(MOCK_REFRESH_TOKEN_ROW);
    vi.mocked(findUserById).mockResolvedValue(MOCK_USER);
    vi.mocked(createRefreshToken).mockResolvedValue('new-refresh-token-plain');
    vi.mocked(deleteRefreshToken).mockResolvedValue(undefined);
    vi.mocked(signToken).mockResolvedValue('new-access-token');

    const response = await app.inject({
      method: 'POST',
      url: '/token',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: 'hub_test1234',
        client_secret: 'plain-secret',
        refresh_token: 'old-refresh-token',
      }).toString(),
    });

    expect(response.statusCode).toBe(200);
    const json = JSON.parse(response.body) as Record<string, unknown>;
    expect(json.access_token).toBe('new-access-token');
    expect(json.refresh_token).toBe('new-refresh-token-plain');
    expect(json.token_type).toBe('bearer');
    expect(json.expires_in).toBe(86400);

    // Old refresh token must be deleted (rotation)
    expect(deleteRefreshToken).toHaveBeenCalledWith(MOCK_REFRESH_TOKEN_ROW.id);
    // A new refresh token must be created for the same client/user
    expect(createRefreshToken).toHaveBeenCalledWith('hub_test1234', MOCK_REFRESH_TOKEN_ROW.userId);
  });

  it('rejects a refresh_token grant when the refresh token is invalid', async () => {
    vi.mocked(findOAuthClient).mockResolvedValue(MOCK_CLIENT);
    vi.mocked(verifyClientSecret).mockResolvedValue(true);
    vi.mocked(findRefreshToken).mockResolvedValue(null);

    const response = await app.inject({
      method: 'POST',
      url: '/token',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: 'hub_test1234',
        client_secret: 'plain-secret',
        refresh_token: 'invalid-token',
      }).toString(),
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toMatchObject({ error: 'invalid_grant' });
    expect(deleteRefreshToken).not.toHaveBeenCalled();
  });

  it('rejects a refresh_token grant when client credentials are wrong', async () => {
    vi.mocked(findOAuthClient).mockResolvedValue(MOCK_CLIENT);
    vi.mocked(verifyClientSecret).mockResolvedValue(false);

    const response = await app.inject({
      method: 'POST',
      url: '/token',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: 'hub_test1234',
        client_secret: 'wrong-secret',
        refresh_token: 'some-token',
      }).toString(),
    });

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body)).toMatchObject({ error: 'invalid_client' });
  });

  it('rejects a refresh_token grant when required params are missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/token',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: 'hub_test1234',
        // missing client_secret and refresh_token
      }).toString(),
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toMatchObject({ error: 'invalid_request' });
  });
});

describe('POST /token — authorization_code grant returns refresh_token', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('includes a refresh_token in the authorization_code grant response', async () => {
    vi.mocked(findOAuthClient).mockResolvedValue(MOCK_CLIENT);
    vi.mocked(verifyClientSecret).mockResolvedValue(true);
    vi.mocked(findUserById).mockResolvedValue(MOCK_USER);
    vi.mocked(createRefreshToken).mockResolvedValue('issued-refresh-token');
    vi.mocked(signToken).mockResolvedValue('issued-access-token');
    vi.mocked(verifyToken).mockResolvedValue({
      client_id: 'hub_test1234',
      user_id: 'user-uuid-1',
      redirect_uri: 'https://example.com/callback',
      code_challenge: 'challenge123',
      code_challenge_method: 'S256',
      exp: Math.floor(Date.now() / 1000) + 300,
    } as AuthCodePayload & JWTPayload);
    vi.mocked(verifyPkceS256).mockReturnValue(true);

    const response = await app.inject({
      method: 'POST',
      url: '/token',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: 'hub_test1234',
        client_secret: 'plain-secret',
        code: 'auth-code',
        redirect_uri: 'https://example.com/callback',
        code_verifier: 'verifier123',
      }).toString(),
    });

    expect(response.statusCode).toBe(200);
    const json = JSON.parse(response.body) as Record<string, unknown>;
    expect(json.access_token).toBe('issued-access-token');
    expect(json.refresh_token).toBe('issued-refresh-token');
    expect(json.token_type).toBe('bearer');
    expect(json.expires_in).toBe(86400);
  });
});

describe('POST /token — client_credentials grant returns refresh_token', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('includes a refresh_token in the client_credentials grant response', async () => {
    vi.mocked(findOAuthClient).mockResolvedValue(MOCK_CLIENT);
    vi.mocked(verifyClientSecret).mockResolvedValue(true);
    vi.mocked(findUserById).mockResolvedValue(MOCK_USER);
    vi.mocked(createRefreshToken).mockResolvedValue('cc-refresh-token');
    vi.mocked(signToken).mockResolvedValue('cc-access-token');

    const response = await app.inject({
      method: 'POST',
      url: '/token',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: 'hub_test1234',
        client_secret: 'plain-secret',
      }).toString(),
    });

    expect(response.statusCode).toBe(200);
    const json = JSON.parse(response.body) as Record<string, unknown>;
    expect(json.access_token).toBe('cc-access-token');
    expect(json.refresh_token).toBe('cc-refresh-token');
    expect(json.token_type).toBe('bearer');
    expect(json.expires_in).toBe(86400);
    expect(createRefreshToken).toHaveBeenCalledWith('hub_test1234', MOCK_CLIENT.userId);
  });
});
