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

-- 2026-05-24: link drafts to prospects (outreach drafts grounded in prospect context)
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS prospect_id INTEGER;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'drafts_prospect_id_fkey' AND table_name = 'drafts'
  ) THEN
    ALTER TABLE drafts
      ADD CONSTRAINT drafts_prospect_id_fkey
      FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS drafts_prospect_id_idx ON drafts (prospect_id);

-- 2026-05-24: leads (upstream of prospects — sourced signals to triage)
CREATE TABLE IF NOT EXISTS leads (
  id                        SERIAL PRIMARY KEY,
  source_type               TEXT NOT NULL DEFAULT 'other',     -- job_posting | rfp | article | social_post | referral_mention | cold_list | other
  source_url                TEXT,
  source_title              TEXT,                              -- "Marketing Manager at Acme Co"
  business_name             TEXT,
  city                      TEXT,
  state                     TEXT,                              -- 2-letter
  industry                  TEXT,                              -- matches prospect industries
  size                      TEXT,                              -- matches prospect sizes
  service_signal            TEXT[] NOT NULL DEFAULT '{}',      -- inferred services they may need
  raw_content               TEXT NOT NULL DEFAULT '',          -- copy of the posting / article body
  notes                     TEXT NOT NULL DEFAULT '',
  status                    TEXT NOT NULL DEFAULT 'new',       -- new | reviewing | qualified | converted | dismissed
  converted_to_prospect_id  INTEGER REFERENCES prospects(id) ON DELETE SET NULL,
  found_by                  TEXT NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status);
CREATE INDEX IF NOT EXISTS leads_source_type_idx ON leads (source_type);
CREATE INDEX IF NOT EXISTS leads_state_idx ON leads (state);
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC);

-- 2026-05-24: link brand_kits to the prospect they were promoted from
ALTER TABLE brand_kits ADD COLUMN IF NOT EXISTS from_prospect_id INTEGER;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'brand_kits_from_prospect_id_fkey' AND table_name = 'brand_kits'
  ) THEN
    ALTER TABLE brand_kits
      ADD CONSTRAINT brand_kits_from_prospect_id_fkey
      FOREIGN KEY (from_prospect_id) REFERENCES prospects(id) ON DELETE SET NULL;
  END IF;
END $$;

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

-- 2026-05-24: etsy_connections (Etsy OAuth tokens per connected shop).
-- Backfill: the etsy.ts module references this table but the CREATE was
-- never committed to schema.sql in the original scaffold.
CREATE TABLE IF NOT EXISTS etsy_connections (
  id              SERIAL PRIMARY KEY,
  shop_id         BIGINT,
  shop_name       TEXT,
  access_token    TEXT NOT NULL,
  refresh_token   TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  scopes          TEXT[] NOT NULL DEFAULT '{}',
  connected_by    TEXT NOT NULL,
  connected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS etsy_connections_shop_id_idx ON etsy_connections (shop_id);
CREATE INDEX IF NOT EXISTS etsy_connections_updated_at_idx ON etsy_connections (updated_at DESC);

-- 2026-05-24: cadences (email cascade MVP).
-- A cadence is an ordered sequence of touchpoints (drafted at send time).
CREATE TABLE IF NOT EXISTS cadences (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  brand_kit_id  INTEGER REFERENCES brand_kits(id) ON DELETE SET NULL,  -- voice to draft in
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cadences_active_idx ON cadences (is_active);

-- Each step describes timing + a prompt; the actual subject/body are
-- generated at send time by Claude using brand voice + prospect context.
CREATE TABLE IF NOT EXISTS cadence_steps (
  id                SERIAL PRIMARY KEY,
  cadence_id        INTEGER NOT NULL REFERENCES cadences(id) ON DELETE CASCADE,
  step_number       INTEGER NOT NULL,            -- 1-indexed
  delay_days        INTEGER NOT NULL DEFAULT 0,  -- days after previous step (or enrollment for step 1)
  delay_hours       INTEGER NOT NULL DEFAULT 0,
  draft_prompt      TEXT NOT NULL,               -- prompt seed for Claude (e.g., "follow-up after no reply, reference original value prop")
  subject_template  TEXT,                        -- optional explicit subject; if null, Claude drafts
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cadence_id, step_number)
);

CREATE INDEX IF NOT EXISTS cadence_steps_cadence_idx ON cadence_steps (cadence_id, step_number);

-- A prospect can be enrolled in at most one active cadence at a time.
CREATE TABLE IF NOT EXISTS prospect_enrollments (
  id              SERIAL PRIMARY KEY,
  prospect_id     INTEGER NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  cadence_id      INTEGER NOT NULL REFERENCES cadences(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'active',  -- active | paused | completed | cancelled
  current_step    INTEGER NOT NULL DEFAULT 0,      -- 0 = not yet sent step 1; advances after each send
  next_send_at    TIMESTAMPTZ,                     -- null when paused/completed/cancelled
  enrolled_by     TEXT NOT NULL,
  enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  cancel_reason   TEXT
);

-- One active enrollment per prospect (regardless of cadence).
CREATE UNIQUE INDEX IF NOT EXISTS prospect_enrollments_active_idx
  ON prospect_enrollments (prospect_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS prospect_enrollments_next_send_idx
  ON prospect_enrollments (next_send_at) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS prospect_enrollments_cadence_idx
  ON prospect_enrollments (cadence_id);

-- Log of every send (or attempted send). One row per step per enrollment.
CREATE TABLE IF NOT EXISTS prospect_sends (
  id                SERIAL PRIMARY KEY,
  enrollment_id     INTEGER NOT NULL REFERENCES prospect_enrollments(id) ON DELETE CASCADE,
  step_id           INTEGER NOT NULL REFERENCES cadence_steps(id),
  step_number       INTEGER NOT NULL,
  to_email          TEXT NOT NULL,
  to_name           TEXT,
  subject           TEXT NOT NULL,
  body              TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',  -- pending | sent | failed | bounced
  resend_message_id TEXT,                              -- Resend's message ID on successful send
  error_message     TEXT,
  scheduled_for     TIMESTAMPTZ NOT NULL,
  sent_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS prospect_sends_enrollment_idx ON prospect_sends (enrollment_id);
CREATE INDEX IF NOT EXISTS prospect_sends_status_idx ON prospect_sends (status);
CREATE INDEX IF NOT EXISTS prospect_sends_scheduled_idx ON prospect_sends (scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS prospect_sends_created_at_idx ON prospect_sends (created_at DESC);

-- 2026-05-24: workspace_connections (Google Workspace OAuth tokens).
-- Single-user pattern for now (one connection = Collie's collie@farleycreative.com).
-- Cadence sends route through here instead of Resend so they land in her Sent folder.
CREATE TABLE IF NOT EXISTS workspace_connections (
  id              SERIAL PRIMARY KEY,
  email           TEXT NOT NULL,                     -- the connected account, e.g. collie@farleycreative.com
  refresh_token   TEXT NOT NULL,                     -- long-lived; used to mint access tokens
  access_token    TEXT,                              -- current short-lived (~1h) access token
  access_expires_at TIMESTAMPTZ,                     -- when access_token expires
  scopes          TEXT[] NOT NULL DEFAULT '{}',      -- granted OAuth scopes
  connected_by    TEXT NOT NULL,
  connected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_connections_email_idx ON workspace_connections (LOWER(email));
CREATE INDEX IF NOT EXISTS workspace_connections_updated_at_idx ON workspace_connections (updated_at DESC);

-- 2026-05-24: prospect_sends.send_via — track which channel each send used
-- (gmail | resend). Defaults to 'gmail' for new sends after this migration.
ALTER TABLE prospect_sends ADD COLUMN IF NOT EXISTS send_via TEXT NOT NULL DEFAULT 'gmail';
