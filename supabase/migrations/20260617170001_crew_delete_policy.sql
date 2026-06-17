-- Allow owners to delete their crew
GRANT DELETE ON public.crews TO authenticated;

CREATE POLICY "crews_delete_owner" ON public.crews
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.crew_members m
      WHERE m.crew_id = crews.id
        AND m.user_id = auth.uid()
        AND m.role = 'owner'
    )
  );
