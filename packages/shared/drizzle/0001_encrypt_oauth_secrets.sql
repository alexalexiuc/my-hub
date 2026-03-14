-- token_signing_secret: text → jsonb (EncryptedString).
-- Existing plaintext rows are wrapped as { value: "<secret>", encrypted: false }
-- so the application layer can read and re-encrypt them transparently on next access.
--
-- client_secret: stays text, but now stores a scrypt hash instead of the raw secret.
-- Existing plaintext values are intentionally left as-is; those clients must re-register
-- since the plain secret is no longer stored and cannot be verified against a hash.
ALTER TABLE "oauth_clients"
  ALTER COLUMN "token_signing_secret" TYPE jsonb
    USING json_build_object('value', token_signing_secret, 'encrypted', false);
