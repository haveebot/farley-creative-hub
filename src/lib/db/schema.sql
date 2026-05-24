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
  theme         TEXT NOT NULL DEFAULT 'light',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Phase 1: theme added 2026-05-24 — light | dark (system option later)
ALTER TABLE hub_preferences ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'light';

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

-- Phase 1: drafts (AI-drafted content — listings, pins, replies, etc.)
CREATE TABLE IF NOT EXISTS drafts (
  id            SERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'general',
  status        TEXT NOT NULL DEFAULT 'draft',
  prompt        TEXT NOT NULL DEFAULT '',
  content       TEXT NOT NULL DEFAULT '',
  brand_kit_id  INTEGER REFERENCES brand_kits(id) ON DELETE SET NULL,
  model_used    TEXT,
  created_by    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS drafts_status_idx ON drafts (status);
CREATE INDEX IF NOT EXISTS drafts_kind_idx ON drafts (kind);
CREATE INDEX IF NOT EXISTS drafts_created_at_idx ON drafts (created_at DESC);

-- Phase 1: sales pipeline (prospects, contacts, activity)
CREATE TABLE IF NOT EXISTS prospects (
  id                SERIAL PRIMARY KEY,
  business_name     TEXT NOT NULL,
  industry          TEXT,
  size              TEXT,                                  -- solo | small | medium | larger
  city              TEXT,
  state             TEXT,                                  -- 2-letter
  website_url       TEXT,
  status            TEXT NOT NULL DEFAULT 'lead',          -- lead | contacted | discovery | proposal | negotiating | signed | passed | dormant
  service_interest  TEXT[] NOT NULL DEFAULT '{}',          -- brand_identity | web_design | marketing | etc.
  notes             TEXT NOT NULL DEFAULT '',
  next_action       TEXT,
  next_action_date  DATE,
  source            TEXT,                                  -- referral | cold_outreach | inbound | event | repeat_client | other
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prospect_contacts (
  id            SERIAL PRIMARY KEY,
  prospect_id   INTEGER NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  role          TEXT,                                       -- owner | marketing_lead | designer | decision_maker | other
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  notes         TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prospect_activity (
  id            SERIAL PRIMARY KEY,
  prospect_id   INTEGER NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,                              -- email_sent | call | meeting | proposal_sent | note | status_change
  content       TEXT NOT NULL DEFAULT '',
  draft_id      INTEGER REFERENCES drafts(id) ON DELETE SET NULL,
  created_by    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS prospects_status_idx ON prospects (status);
CREATE INDEX IF NOT EXISTS prospects_state_idx ON prospects (state);
CREATE INDEX IF NOT EXISTS prospects_industry_idx ON prospects (industry);
CREATE INDEX IF NOT EXISTS prospects_next_action_date_idx ON prospects (next_action_date);
CREATE INDEX IF NOT EXISTS prospect_contacts_prospect_idx ON prospect_contacts (prospect_id);
CREATE INDEX IF NOT EXISTS prospect_activity_prospect_idx ON prospect_activity (prospect_id);
CREATE INDEX IF NOT EXISTS prospect_activity_created_at_idx ON prospect_activity (created_at DESC);
