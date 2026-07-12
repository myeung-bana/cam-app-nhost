ALTER TABLE public.media
  DROP COLUMN IF EXISTS filter_preset_id,
  DROP COLUMN IF EXISTS baked_url,
  DROP COLUMN IF EXISTS bake_status;

DROP INDEX IF EXISTS media_bake_status_idx;
