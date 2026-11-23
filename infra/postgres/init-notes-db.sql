-- Creates the `notes` role and database (the disposable notes search index) next to the app database.
-- Idempotent; run by psql as the superuser: psql -v ON_ERROR_STOP=1 -v notes_password=... -f init-notes-db.sql
\set ON_ERROR_STOP on

-- psql variables are not interpolated inside DO $$ blocks, so build the statements with format() + \gexec.
SELECT format('CREATE ROLE notes LOGIN PASSWORD %L', :'notes_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'notes') \gexec

SELECT format('ALTER ROLE notes WITH LOGIN PASSWORD %L', :'notes_password') \gexec

-- CREATE DATABASE cannot run inside a DO block or a transaction.
SELECT 'CREATE DATABASE notes OWNER notes'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'notes') \gexec

-- `notes` is not a superuser, so the extensions are created here, not by the app.
\connect notes
CREATE EXTENSION IF NOT EXISTS vector SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA public;
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA public;
