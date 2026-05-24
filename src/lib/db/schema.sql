-- Farley Creative Hub — schema
--
-- Idempotent: safe to run repeatedly. Each phase adds new tables here.

-- Phase 1: users (operator accounts)
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'operator',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (LOWER(email));

-- Phase 1: hub_preferences (Hub-only look + feel — operator chrome)
CREATE TABLE IF NOT EXISTS hub_preferences (
  id            SERIAL PRIMARY KEY,
  hub_label     TEXT NOT NULL DEFAULT 'Farley Creative Hub',
  accent_color  TEXT NOT NULL DEFAULT '#c97d5d',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Phase 1: brand_kits (studio + clients; same shape, scoped by is_studio_self)
CREATE TABLE IF NOT EXISTS brand_kits (
  id                SERIAL PRIMARY KEY,
  name              TEXT NOT NULL,
  is_studio_self    BOOLEAN NOT NULL DEFAULT FALSE,
  bio               TEXT NOT NULL DEFAULT '',
  primary_color     TEXT NOT NULL DEFAULT '#1a1a1a',
  secondary_color   TEXT NOT NULL DEFAULT '',
  accent_color      TEXT NOT NULL DEFAULT '',
  voice_notes       TEXT NOT NULL DEFAULT '',
  brand_book_notes  TEXT NOT NULL DEFAULT '',
  etsy_shop_url     TEXT NOT NULL DEFAULT '',
  website_url       TEXT NOT NULL DEFAULT '',
  instagram_url     TEXT NOT NULL DEFAULT '',
  pinterest_url     TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS brand_kits_studio_self_idx
  ON brand_kits (is_studio_self) WHERE is_studio_self = TRUE;

-- Phase 1: agent_tokens (programmatic API access)
CREATE TABLE IF NOT EXISTS agent_tokens (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  token_hash    TEXT NOT NULL UNIQUE,
  token_prefix  TEXT NOT NULL,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS agent_tokens_active_idx
  ON agent_tokens (token_hash) WHERE revoked_at IS NULL;

-- Phase 1: assets (file library — logos, brand books, design masters, etc.)
CREATE TABLE IF NOT EXISTS assets (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  filename      TEXT NOT NULL,
  url           TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    BIGINT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'general',
  brand_kit_id  INTEGER REFERENCES brand_kits(id) ON DELETE SET NULL,
  description   TEXT NOT NULL DEFAULT '',
  uploaded_by   TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS assets_kind_idx ON assets (kind);
CREATE INDEX IF NOT EXISTS assets_brand_kit_idx ON assets (brand_kit_id);
CREATE INDEX IF NOT EXISTS assets_created_at_idx ON assets (created_at DESC);
