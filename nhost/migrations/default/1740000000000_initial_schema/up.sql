-- Memo — initial PostgreSQL schema
-- Aligns with cam-app-admin/lib/types and documentation/PRD-v2.md §8
--
-- Usage:
--   psql $DATABASE_URL -f documentation/db/001_initial_schema.sql
--   Or convert to a Hasura migration under cam-app-nhost/nhost/migrations/
--
-- Notes:
--   • Nhost manages auth.users in the auth schema — link via nhost_user_id where noted.
--   • Hasura row-level permissions are configured separately in metadata.
--   • file_url on media may later become storage_file_id (Nhost Storage file id).

BEGIN;

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------

CREATE TYPE public.event_status AS ENUM (
  'draft',
  'ready',
  'live',
  'ended',
  'archived'
);

CREATE TYPE public.client_status AS ENUM (
  'invited',
  'portal_active',
  'event_completed',
  'archived'
);

CREATE TYPE public.reel_status AS ENUM (
  'queued',
  'processing',
  'ready',
  'failed'
);

CREATE TYPE public.admin_user_role AS ENUM (
  'owner',
  'admin'
);

CREATE TYPE public.admin_user_status AS ENUM (
  'active',
  'inactive'
);

CREATE TYPE public.media_file_type AS ENUM (
  'photo',
  'video'
);

CREATE TYPE public.notification_status AS ENUM (
  'pending',
  'sent',
  'failed'
);

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Taxonomy — configurable event types and challenge templates
-- ---------------------------------------------------------------------------

CREATE TABLE public.event_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT event_types_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TRIGGER event_types_set_updated_at
  BEFORE UPDATE ON public.event_types
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE INDEX event_types_active_sort_idx ON public.event_types (active, sort_order);

COMMENT ON TABLE public.event_types IS 'Admin taxonomy — event type catalogue (wedding, corporate, etc.)';

CREATE TABLE public.challenge_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT NOT NULL UNIQUE,
  label            TEXT NOT NULL,
  description      TEXT,
  icon             TEXT NOT NULL DEFAULT '📸',
  is_required      BOOLEAN NOT NULL DEFAULT FALSE,
  event_type_slug  TEXT REFERENCES public.event_types (slug) ON UPDATE CASCADE ON DELETE SET NULL,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT challenge_templates_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TRIGGER challenge_templates_set_updated_at
  BEFORE UPDATE ON public.challenge_templates
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE INDEX challenge_templates_event_type_idx ON public.challenge_templates (event_type_slug);
CREATE INDEX challenge_templates_active_sort_idx ON public.challenge_templates (active, sort_order);

COMMENT ON TABLE public.challenge_templates IS 'Admin taxonomy — reusable challenge definitions per event type';

-- ---------------------------------------------------------------------------
-- Clients — CRM hub; portal users link to auth.users via nhost_user_id
-- ---------------------------------------------------------------------------

CREATE TABLE public.clients (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT NOT NULL,
  organisation           TEXT,
  email                  TEXT NOT NULL,
  phone                  TEXT,
  wedding_date           DATE,
  event_type_preference  TEXT REFERENCES public.event_types (slug) ON UPDATE CASCADE ON DELETE SET NULL,
  notes                  TEXT,
  status                 public.client_status NOT NULL DEFAULT 'invited',
  portal_last_login_at   TIMESTAMPTZ,
  archived               BOOLEAN NOT NULL DEFAULT FALSE,
  nhost_user_id          UUID,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT clients_email_unique UNIQUE (email)
);

CREATE TRIGGER clients_set_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE INDEX clients_status_idx ON public.clients (status);
CREATE INDEX clients_archived_idx ON public.clients (archived);
CREATE INDEX clients_nhost_user_id_idx ON public.clients (nhost_user_id);

COMMENT ON TABLE public.clients IS 'Client CRM records — one row per client portal account';
COMMENT ON COLUMN public.clients.nhost_user_id IS 'Optional FK to auth.users.id once provisioned in Nhost Auth';

-- ---------------------------------------------------------------------------
-- Events — core operational entity
-- ---------------------------------------------------------------------------

CREATE TABLE public.events (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES public.clients (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  name                    TEXT NOT NULL,
  event_type              TEXT NOT NULL REFERENCES public.event_types (slug) ON UPDATE CASCADE ON DELETE RESTRICT,
  start_time              TIMESTAMPTZ NOT NULL,
  end_time                TIMESTAMPTZ NOT NULL,
  venue_name              TEXT,
  max_attendees           INTEGER NOT NULL CHECK (max_attendees > 0),
  join_code               TEXT NOT NULL UNIQUE,
  qr_access_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  join_code_rotated_at    TIMESTAMPTZ,
  status                  public.event_status NOT NULL DEFAULT 'draft',
  accent_color            TEXT,
  cover_image_url         TEXT,
  portal_gallery_visible  BOOLEAN NOT NULL DEFAULT FALSE,
  reel_shareable          BOOLEAN NOT NULL DEFAULT FALSE,
  retention_expires_at    TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT events_time_window CHECK (end_time > start_time),
  CONSTRAINT events_accent_color_format CHECK (
    accent_color IS NULL OR accent_color ~ '^#[0-9A-Fa-f]{6}$'
  )
);

CREATE TRIGGER events_set_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE INDEX events_client_id_idx ON public.events (client_id);
CREATE INDEX events_status_idx ON public.events (status);
CREATE INDEX events_start_time_idx ON public.events (start_time);
CREATE INDEX events_event_type_idx ON public.events (event_type);

COMMENT ON TABLE public.events IS 'Live capture events — QR access, media, reels scoped per event';

-- ---------------------------------------------------------------------------
-- Guest sessions — anonymous guest PWA participants
-- ---------------------------------------------------------------------------

CREATE TABLE public.guest_sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           UUID NOT NULL REFERENCES public.events (id) ON UPDATE CASCADE ON DELETE CASCADE,
  display_name       TEXT,
  nhost_user_id      UUID,
  joined_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_heartbeat_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT guest_sessions_display_name_length CHECK (
    display_name IS NULL OR char_length(display_name) <= 100
  )
);

CREATE INDEX guest_sessions_event_id_idx ON public.guest_sessions (event_id);
CREATE INDEX guest_sessions_event_heartbeat_idx ON public.guest_sessions (event_id, last_heartbeat_at DESC);
CREATE INDEX guest_sessions_nhost_user_id_idx ON public.guest_sessions (nhost_user_id);

COMMENT ON TABLE public.guest_sessions IS 'Guest PWA sessions — optional display name, scoped to one event';

-- ---------------------------------------------------------------------------
-- Challenges — per-event challenge list (copied from templates or custom)
-- ---------------------------------------------------------------------------

CREATE TABLE public.challenges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES public.events (id) ON UPDATE CASCADE ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  icon            TEXT NOT NULL DEFAULT '📸',
  is_required     BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  template_slug   TEXT REFERENCES public.challenge_templates (slug) ON UPDATE CASCADE ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER challenges_set_updated_at
  BEFORE UPDATE ON public.challenges
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE INDEX challenges_event_id_sort_idx ON public.challenges (event_id, sort_order);

COMMENT ON TABLE public.challenges IS 'Event-scoped photo/video challenges for guest gamification';

-- ---------------------------------------------------------------------------
-- Media — guest uploads linked to event (and optionally session / challenge)
-- ---------------------------------------------------------------------------

CREATE TABLE public.media (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES public.events (id) ON UPDATE CASCADE ON DELETE CASCADE,
  session_id      UUID REFERENCES public.guest_sessions (id) ON UPDATE CASCADE ON DELETE SET NULL,
  file_url        TEXT NOT NULL,
  storage_file_id UUID,
  file_type       public.media_file_type NOT NULL,
  filter_applied  TEXT,
  challenge_id    UUID REFERENCES public.challenges (id) ON UPDATE CASCADE ON DELETE SET NULL,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quality_score   NUMERIC(5, 2),
  is_hidden       BOOLEAN NOT NULL DEFAULT FALSE,
  is_starred      BOOLEAN NOT NULL DEFAULT FALSE,

  CONSTRAINT media_quality_score_range CHECK (
    quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100)
  )
);

CREATE INDEX media_event_id_idx ON public.media (event_id);
CREATE INDEX media_event_uploaded_idx ON public.media (event_id, uploaded_at DESC);
CREATE INDEX media_session_id_idx ON public.media (session_id);
CREATE INDEX media_challenge_id_idx ON public.media (challenge_id);
CREATE INDEX media_event_starred_idx ON public.media (event_id, is_starred) WHERE is_starred = TRUE;

COMMENT ON TABLE public.media IS 'Guest and admin media assets — file_url or storage_file_id from Nhost Storage';
COMMENT ON COLUMN public.media.storage_file_id IS 'Preferred: Nhost Storage file id; derive URL at render time';

-- ---------------------------------------------------------------------------
-- Challenge completions — guest fulfilled a challenge with a media item
-- ---------------------------------------------------------------------------

CREATE TABLE public.challenge_completions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id  UUID NOT NULL REFERENCES public.challenges (id) ON UPDATE CASCADE ON DELETE CASCADE,
  session_id    UUID NOT NULL REFERENCES public.guest_sessions (id) ON UPDATE CASCADE ON DELETE CASCADE,
  media_id      UUID NOT NULL REFERENCES public.media (id) ON UPDATE CASCADE ON DELETE CASCADE,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT challenge_completions_unique_per_session UNIQUE (challenge_id, session_id)
);

CREATE INDEX challenge_completions_challenge_id_idx ON public.challenge_completions (challenge_id);
CREATE INDEX challenge_completions_session_id_idx ON public.challenge_completions (session_id);

-- ---------------------------------------------------------------------------
-- Milestones — upload-count triggers during live events
-- ---------------------------------------------------------------------------

CREATE TABLE public.milestones (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID NOT NULL REFERENCES public.events (id) ON UPDATE CASCADE ON DELETE CASCADE,
  label          TEXT NOT NULL,
  trigger_count  INTEGER NOT NULL CHECK (trigger_count > 0),
  achieved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX milestones_event_id_idx ON public.milestones (event_id);

-- ---------------------------------------------------------------------------
-- Reels — AI-generated highlight reels per event
-- ---------------------------------------------------------------------------

CREATE TABLE public.reels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES public.events (id) ON UPDATE CASCADE ON DELETE CASCADE,
  output_url    TEXT,
  status        public.reel_status NOT NULL DEFAULT 'queued',
  music_track   TEXT,
  description   TEXT,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER reels_set_updated_at
  BEFORE UPDATE ON public.reels
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE INDEX reels_event_id_idx ON public.reels (event_id);
CREATE INDEX reels_status_idx ON public.reels (status);

-- ---------------------------------------------------------------------------
-- Admin users — Memo platform operators (may mirror auth.users)
-- ---------------------------------------------------------------------------

CREATE TABLE public.admin_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  role            public.admin_user_role NOT NULL DEFAULT 'admin',
  status          public.admin_user_status NOT NULL DEFAULT 'active',
  phone           TEXT,
  notes           TEXT,
  last_login_at   TIMESTAMPTZ,
  nhost_user_id   UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT admin_users_email_unique UNIQUE (email)
);

CREATE TRIGGER admin_users_set_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE INDEX admin_users_status_idx ON public.admin_users (status);
CREATE INDEX admin_users_nhost_user_id_idx ON public.admin_users (nhost_user_id);

COMMENT ON TABLE public.admin_users IS 'Memo admin portal operators — role admin enforced in app + Hasura';

-- ---------------------------------------------------------------------------
-- Activity log — platform-wide audit / dashboard feed
-- ---------------------------------------------------------------------------

CREATE TABLE public.activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,
  label       TEXT NOT NULL,
  entity_ref  TEXT,
  client_id   UUID REFERENCES public.clients (id) ON UPDATE CASCADE ON DELETE SET NULL,
  event_id    UUID REFERENCES public.events (id) ON UPDATE CASCADE ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX activity_log_created_at_idx ON public.activity_log (created_at DESC);
CREATE INDEX activity_log_event_id_idx ON public.activity_log (event_id);
CREATE INDEX activity_log_client_id_idx ON public.activity_log (client_id);

-- ---------------------------------------------------------------------------
-- Notifications — outbound email / message log
-- ---------------------------------------------------------------------------

CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID REFERENCES public.clients (id) ON UPDATE CASCADE ON DELETE SET NULL,
  event_id    UUID REFERENCES public.events (id) ON UPDATE CASCADE ON DELETE SET NULL,
  type        TEXT NOT NULL,
  status      public.notification_status NOT NULL DEFAULT 'pending',
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX notifications_client_id_idx ON public.notifications (client_id);
CREATE INDEX notifications_event_id_idx ON public.notifications (event_id);
CREATE INDEX notifications_status_idx ON public.notifications (status);

COMMIT;
