
CREATE POLICY "Plan images viewable by authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'plan-images');

CREATE POLICY "Users can upload own plan images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'plan-images' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "Users can update own plan images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'plan-images' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "Users can delete own plan images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'plan-images' AND (storage.foldername(name))[1] = (auth.uid())::text);
