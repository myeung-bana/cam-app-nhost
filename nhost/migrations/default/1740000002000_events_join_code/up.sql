-- Ensure join-code columns exist on events (for cloud DBs created before full schema deploy)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS join_code TEXT,
  ADD COLUMN IF NOT EXISTS qr_access_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS join_code_rotated_at TIMESTAMPTZ;

-- Backfill join codes for any existing rows
UPDATE public.events
SET join_code = upper(substr(replace(id::text, '-', ''), 1, 10))
WHERE join_code IS NULL;

ALTER TABLE public.events
  ALTER COLUMN join_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS events_join_code_unique_idx
  ON public.events (join_code);
