-- Add server-side bake columns for deterministic filter processing
ALTER TABLE public.media
  ADD COLUMN IF NOT EXISTS filter_preset_id text,
  ADD COLUMN IF NOT EXISTS baked_url text,
  ADD COLUMN IF NOT EXISTS bake_status text NOT NULL DEFAULT 'pending';

COMMENT ON COLUMN public.media.filter_preset_id IS 'Filter preset id applied at capture — used by media/bake function';
COMMENT ON COLUMN public.media.baked_url IS 'URL of server-baked asset after sharp/FFmpeg processing';
COMMENT ON COLUMN public.media.bake_status IS 'pending | done | failed';

CREATE INDEX IF NOT EXISTS media_bake_status_idx ON public.media (bake_status)
  WHERE bake_status <> 'done';
