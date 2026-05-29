-- Farley Creative Hub — schema
--
-- Idempotent: safe to run repeatedly. Each phase adds new tables here.
-- Ordering rule: a CREATE TABLE or ALTER TABLE that references another
-- table via foreign key must appear AFTER that referenced table's
-- CREATE TABLE. Re-arrange accordingly when adding new constraints.

-- ============ users (operator accounts) ============
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'operator',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (LOWER(email));

-- ============ hub_preferences ============
CREATE TABLE IF NOT EXISTS hub_preferences (
  id            SERIAL PRIMARY KEY,
  hub_label     TEXT NOT NULL DEFAULT 'Farley Creative Hub',
  accent_color  TEXT NOT NULL DEFAULT '#c97d5d',
  theme         TEXT NOT NULL DEFAULT 'light',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE hub_preferences ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'light';
ALTER TABLE hub_preferences ADD COLUMN IF NOT EXISTS favicon_url TEXT;

-- ============ brand_kits ============
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

-- Brand kit depth — non-FK additions, safe to do here.
ALTER TABLE brand_kits ADD COLUMN IF NOT EXISTS writing_samples TEXT NOT NULL DEFAULT '';
ALTER TABLE brand_kits ADD COLUMN IF NOT EXISTS always_say TEXT[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE brand_kits ADD COLUMN IF NOT EXISTS never_say TEXT[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE brand_kits ADD COLUMN IF NOT EXISTS audience_persona TEXT NOT NULL DEFAULT '';
ALTER TABLE brand_kits ADD COLUMN IF NOT EXISTS differentiators TEXT NOT NULL DEFAULT '';

-- ============ agent_tokens ============
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

-- ============ assets ============
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

-- ============ drafts ============
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

-- ============ prospects + contacts + activity ============
-- MUST be created BEFORE any FK references to prospects.id (drafts,
-- brand_kits, leads, cadences-related tables all reference it).
CREATE TABLE IF NOT EXISTS prospects (
  id                SERIAL PRIMARY KEY,
  business_name     TEXT NOT NULL,
  industry          TEXT,
  size              TEXT,
  city              TEXT,
  state             TEXT,
  website_url       TEXT,
  status            TEXT NOT NULL DEFAULT 'lead',
  service_interest  TEXT[] NOT NULL DEFAULT '{}',
  notes             TEXT NOT NULL DEFAULT '',
  next_action       TEXT,
  next_action_date  DATE,
  source            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prospect_contacts (
  id            SERIAL PRIMARY KEY,
  prospect_id   INTEGER NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  role          TEXT,
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  notes         TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prospect_activity (
  id            SERIAL PRIMARY KEY,
  prospect_id   INTEGER NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,
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

-- ============ drafts → prospects FK (added after prospects exists) ============
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

-- ============ brand_kits → prospects FK (added after prospects exists) ============
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

-- ============ leads (FK to prospects) ============
CREATE TABLE IF NOT EXISTS leads (
  id                        SERIAL PRIMARY KEY,
  source_type               TEXT NOT NULL DEFAULT 'other',
  source_url                TEXT,
  source_title              TEXT,
  business_name             TEXT,
  city                      TEXT,
  state                     TEXT,
  industry                  TEXT,
  size                      TEXT,
  service_signal            TEXT[] NOT NULL DEFAULT '{}',
  raw_content               TEXT NOT NULL DEFAULT '',
  notes                     TEXT NOT NULL DEFAULT '',
  status                    TEXT NOT NULL DEFAULT 'new',
  converted_to_prospect_id  INTEGER REFERENCES prospects(id) ON DELETE SET NULL,
  found_by                  TEXT NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status);
CREATE INDEX IF NOT EXISTS leads_source_type_idx ON leads (source_type);
CREATE INDEX IF NOT EXISTS leads_state_idx ON leads (state);
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC);

-- First-touch outreach tracking (added 2026-05-26)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_touch_drafted_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_touch_gmail_draft_id TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_touch_subject TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_touch_jd_source TEXT;

-- Company enrichment persistence (added 2026-05-26)
-- website_url + contacts persist on the lead so the roster survives
-- refreshes, machine changes, etc. Without persistence the operator
-- has to re-enrich every visit.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contacts JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS enrichment_notes TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_touch_body TEXT;

-- ============ etsy_connections ============
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

-- ============ cadences + steps ============
CREATE TABLE IF NOT EXISTS cadences (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  brand_kit_id  INTEGER REFERENCES brand_kits(id) ON DELETE SET NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cadences_active_idx ON cadences (is_active);

CREATE TABLE IF NOT EXISTS cadence_steps (
  id                SERIAL PRIMARY KEY,
  cadence_id        INTEGER NOT NULL REFERENCES cadences(id) ON DELETE CASCADE,
  step_number       INTEGER NOT NULL,
  delay_days        INTEGER NOT NULL DEFAULT 0,
  delay_hours       INTEGER NOT NULL DEFAULT 0,
  draft_prompt      TEXT NOT NULL,
  subject_template  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cadence_id, step_number)
);

CREATE INDEX IF NOT EXISTS cadence_steps_cadence_idx ON cadence_steps (cadence_id, step_number);

-- ============ prospect_enrollments + sends ============
CREATE TABLE IF NOT EXISTS prospect_enrollments (
  id              SERIAL PRIMARY KEY,
  prospect_id     INTEGER NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  cadence_id      INTEGER NOT NULL REFERENCES cadences(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'active',
  current_step    INTEGER NOT NULL DEFAULT 0,
  next_send_at    TIMESTAMPTZ,
  enrolled_by     TEXT NOT NULL,
  enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  cancel_reason   TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS prospect_enrollments_active_idx
  ON prospect_enrollments (prospect_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS prospect_enrollments_next_send_idx
  ON prospect_enrollments (next_send_at) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS prospect_enrollments_cadence_idx
  ON prospect_enrollments (cadence_id);

CREATE TABLE IF NOT EXISTS prospect_sends (
  id                SERIAL PRIMARY KEY,
  enrollment_id     INTEGER NOT NULL REFERENCES prospect_enrollments(id) ON DELETE CASCADE,
  step_id           INTEGER NOT NULL REFERENCES cadence_steps(id),
  step_number       INTEGER NOT NULL,
  to_email          TEXT NOT NULL,
  to_name           TEXT,
  subject           TEXT NOT NULL,
  body              TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  resend_message_id TEXT,
  error_message     TEXT,
  scheduled_for     TIMESTAMPTZ NOT NULL,
  sent_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE prospect_sends ADD COLUMN IF NOT EXISTS send_via TEXT NOT NULL DEFAULT 'gmail';

CREATE INDEX IF NOT EXISTS prospect_sends_enrollment_idx ON prospect_sends (enrollment_id);
CREATE INDEX IF NOT EXISTS prospect_sends_status_idx ON prospect_sends (status);
CREATE INDEX IF NOT EXISTS prospect_sends_scheduled_idx ON prospect_sends (scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS prospect_sends_created_at_idx ON prospect_sends (created_at DESC);

-- ============ workspace_connections ============
CREATE TABLE IF NOT EXISTS workspace_connections (
  id              SERIAL PRIMARY KEY,
  email           TEXT NOT NULL,
  refresh_token   TEXT NOT NULL,
  access_token    TEXT,
  access_expires_at TIMESTAMPTZ,
  scopes          TEXT[] NOT NULL DEFAULT '{}',
  connected_by    TEXT NOT NULL,
  connected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_connections_email_idx ON workspace_connections (LOWER(email));
CREATE INDEX IF NOT EXISTS workspace_connections_updated_at_idx ON workspace_connections (updated_at DESC);

ALTER TABLE workspace_connections ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'sending';

CREATE UNIQUE INDEX IF NOT EXISTS workspace_connections_purpose_idx
  ON workspace_connections (purpose);

-- ============ daily_briefings ============
CREATE TABLE IF NOT EXISTS daily_briefings (
  id              SERIAL PRIMARY KEY,
  for_date        DATE NOT NULL UNIQUE,
  content         TEXT NOT NULL,
  context_summary JSONB NOT NULL DEFAULT '{}',
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS daily_briefings_for_date_idx ON daily_briefings (for_date DESC);

-- ============ listings ============
CREATE TABLE IF NOT EXISTS listings (
  id              SERIAL PRIMARY KEY,
  working_name    TEXT NOT NULL,
  asset_id        INTEGER REFERENCES assets(id) ON DELETE SET NULL,
  brand_kit_id    INTEGER REFERENCES brand_kits(id) ON DELETE SET NULL,
  context_notes   TEXT NOT NULL DEFAULT '',
  title           TEXT NOT NULL DEFAULT '',
  description     TEXT NOT NULL DEFAULT '',
  tags            TEXT[] NOT NULL DEFAULT '{}',
  keywords        TEXT[] NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'draft',
  ai_model_used   TEXT,
  created_by      TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  posted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS listings_status_idx ON listings (status);
CREATE INDEX IF NOT EXISTS listings_asset_id_idx ON listings (asset_id);
CREATE INDEX IF NOT EXISTS listings_created_at_idx ON listings (created_at DESC);

-- Etsy-publishing fields. price_cents/quantity required for a push;
-- taxonomy + shipping profile are picked once per listing from Etsy.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS price_cents INTEGER;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS etsy_listing_id BIGINT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS etsy_state TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS etsy_taxonomy_id INTEGER;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS etsy_shipping_profile_id BIGINT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS etsy_who_made TEXT NOT NULL DEFAULT 'i_did';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS etsy_when_made TEXT NOT NULL DEFAULT 'made_to_order';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS etsy_pushed_at TIMESTAMPTZ;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS etsy_synced_at TIMESTAMPTZ;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS etsy_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS listings_etsy_listing_id_idx ON listings (etsy_listing_id) WHERE etsy_listing_id IS NOT NULL;

-- ============ listing_images (multi-image attachments to a listing) ============
CREATE TABLE IF NOT EXISTS listing_images (
  id            SERIAL PRIMARY KEY,
  listing_id    INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  asset_id      INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL DEFAULT 0,
  etsy_image_id BIGINT,
  uploaded_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS listing_images_listing_idx ON listing_images (listing_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS listing_images_unique ON listing_images (listing_id, asset_id);

-- ============ etsy_taxonomy_cache (server-side cache of Etsy's tree) ============
CREATE TABLE IF NOT EXISTS etsy_taxonomy_cache (
  id          INTEGER PRIMARY KEY,
  parent_id   INTEGER,
  name        TEXT NOT NULL,
  level       INTEGER NOT NULL,
  path        TEXT NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS etsy_taxonomy_cache_parent_idx ON etsy_taxonomy_cache (parent_id);
CREATE INDEX IF NOT EXISTS etsy_taxonomy_cache_name_idx ON etsy_taxonomy_cache (LOWER(name));

-- ============ voice_profiles (first-class voice, separate from brand kits) ============
-- A voice profile is a reusable "how to sound" — independent of the visual
-- brand. A draft picks a voice profile to apply, with optional brand_kit
-- override of other fields (colors, audience, etc).
CREATE TABLE IF NOT EXISTS voice_profiles (
  id                SERIAL PRIMARY KEY,
  name              TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  voice_notes       TEXT NOT NULL DEFAULT '',
  writing_samples   TEXT NOT NULL DEFAULT '',
  always_say        TEXT[] NOT NULL DEFAULT '{}'::text[],
  never_say         TEXT[] NOT NULL DEFAULT '{}'::text[],
  audience_persona  TEXT NOT NULL DEFAULT '',
  is_default        BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one voice profile can be the default at a time
CREATE UNIQUE INDEX IF NOT EXISTS voice_profiles_default_unique
  ON voice_profiles (is_default) WHERE is_default = true;

-- Drafts can optionally point at a voice profile (overrides the brand_kit
-- voice fields when set; falls back to brand_kit voice fields when null)
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS voice_profile_id INTEGER;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drafts_voice_profile_fk'
  ) THEN
    ALTER TABLE drafts
      ADD CONSTRAINT drafts_voice_profile_fk
      FOREIGN KEY (voice_profile_id) REFERENCES voice_profiles(id) ON DELETE SET NULL;
  END IF;
END$$;

-- ============ site_pageviews ============
-- Tenant-owned web analytics. Each pageview is a row.
-- Privacy-preserving: no PII, no raw IP, no raw UA.
-- visitor_id is a daily-rotating hash of (IP + UA + salt + date) for
-- unique-visitor counts that reset each day. No cross-day tracking.
-- Added 2026-05-26 after Vercel Web Analytics API confirmed not publicly
-- exposed (the prior fetcher silently returned zeros for 3 days).
CREATE TABLE IF NOT EXISTS site_pageviews (
  id          SERIAL PRIMARY KEY,
  site_id     TEXT NOT NULL,            -- e.g. 'farleycreative.com'
  path        TEXT NOT NULL,
  referrer    TEXT,                     -- null = direct or internal nav
  country     TEXT,                     -- ISO 3166-1 alpha-2 from Vercel geo header
  visitor_id  TEXT NOT NULL,            -- daily-rotating hash
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS site_pageviews_site_created_idx
  ON site_pageviews (site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS site_pageviews_path_idx
  ON site_pageviews (site_id, path);
CREATE INDEX IF NOT EXISTS site_pageviews_visitor_idx
  ON site_pageviews (site_id, visitor_id);
