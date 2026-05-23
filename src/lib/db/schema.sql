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

-- Phase 1: brand_identity (studio brand — single row for now; multi-tenant later)
CREATE TABLE IF NOT EXISTS brand_identity (
  id              SERIAL PRIMARY KEY,
  studio_name     TEXT NOT NULL DEFAULT 'Farley Girls Creative',
  hub_label       TEXT NOT NULL DEFAULT 'Farley Creative Hub',
  bio             TEXT NOT NULL DEFAULT '',
  primary_color   TEXT NOT NULL DEFAULT '#c97d5d',
  voice_notes     TEXT NOT NULL DEFAULT '',
  etsy_shop_url   TEXT NOT NULL DEFAULT '',
  website_url     TEXT NOT NULL DEFAULT '',
  instagram_url   TEXT NOT NULL DEFAULT '',
  pinterest_url   TEXT NOT NULL DEFAULT '',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
