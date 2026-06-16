ALTER TABLE public.crew_members ADD COLUMN IF NOT EXISTS chat_open_until timestamptz;

CREATE POLICY "Members update own chat presence"
ON public.crew_members
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());