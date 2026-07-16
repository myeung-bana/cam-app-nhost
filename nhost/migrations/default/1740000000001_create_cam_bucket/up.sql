-- Ensure Nhost Storage buckets exist for guest/admin uploads.
-- cam-bucket matches NEXT_PUBLIC_STORAGE_BUCKET / NHOST_STORAGE_BUCKET in cam-app-client.

INSERT INTO storage.buckets (
  id,
  max_upload_file_size,
  cache_control,
  presigned_urls_enabled,
  download_expiration
)
VALUES
  ('default', 52428800, 'public, max-age=3600', false, 300),
  ('cam-bucket', 52428800, 'private, max-age=3600', false, 300)
ON CONFLICT (id) DO NOTHING;
