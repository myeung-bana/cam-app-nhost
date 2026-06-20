INSERT INTO public.event_types (slug, label, description, sort_order, active) VALUES
  ('wedding', 'Wedding', 'Ceremonies, receptions, and wedding celebrations', 0, true),
  ('birthday', 'Birthday', 'Birthday parties and milestone celebrations', 1, true),
  ('corporate', 'Corporate', 'Retreats, conferences, and team events', 2, true),
  ('milestone', 'Life milestone', 'Graduations, anniversaries, and personal milestones', 3, true),
  ('social', 'Social / private', 'Private gatherings and social events', 4, true),
  ('community', 'Community', 'Community meetups and public events', 5, true),
  ('other', 'Other', 'Custom or uncategorized event types', 6, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.challenge_templates (slug, label, description, icon, is_required, event_type_slug, sort_order, active) VALUES
  ('candid-laugh', 'Capture a candid laugh', 'A natural moment of joy', '📸', false, 'wedding', 0, true),
  ('dance-floor', 'Dance floor moment', 'Photo from the dance floor', '💃', false, 'wedding', 1, true),
  ('toast-moment', 'Toast moment', 'Clink those glasses', '🥂', false, 'wedding', 2, true),
  ('photo-with-couple', 'Photo with the couple', 'A shot with the happy couple', '👰', true, 'wedding', 3, true),
  ('best-venue', 'Best venue shot', 'Capture the venue at its best', '🌅', false, 'wedding', 4, true),
  ('team-photo', 'Team photo', 'Group shot with your team', '👥', true, 'corporate', 0, true),
  ('presentation', 'Presentation moment', 'Someone on stage or presenting', '🎤', false, 'corporate', 1, true),
  ('networking', 'Networking', 'People connecting over coffee', '☕', false, 'corporate', 2, true),
  ('cake-moment', 'Cake moment', 'Blowing out candles or cutting cake', '🎂', true, 'birthday', 0, true),
  ('group-selfie', 'Group selfie', 'Selfie with friends', '🤳', false, 'birthday', 1, true)
ON CONFLICT (slug) DO NOTHING;
