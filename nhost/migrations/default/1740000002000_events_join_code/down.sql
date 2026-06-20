DROP INDEX IF EXISTS public.events_join_code_unique_idx;

ALTER TABLE public.events
  DROP COLUMN IF EXISTS join_code_rotated_at,
  DROP COLUMN IF EXISTS qr_access_enabled,
  DROP COLUMN IF EXISTS join_code;
