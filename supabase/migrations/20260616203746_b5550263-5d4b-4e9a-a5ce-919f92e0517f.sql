DROP POLICY IF EXISTS "crews_select_by_invite" ON public.crews;

DROP POLICY IF EXISTS "crew members update messages" ON public.messages;
CREATE POLICY "authors update own messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (author_id = auth.uid() AND public.is_member_of(crew_id))
WITH CHECK (author_id = auth.uid() AND public.is_member_of(crew_id));

CREATE OR REPLACE FUNCTION public.join_crew_by_code(_code text)
RETURNS public.crews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_crew public.crews;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT * INTO v_crew FROM public.crews
   WHERE invite_code = upper(trim(_code))
   LIMIT 1;
  IF v_crew.id IS NULL THEN
    RAISE EXCEPTION 'No crew found for that code';
  END IF;
  INSERT INTO public.crew_members (crew_id, user_id, role)
  VALUES (v_crew.id, v_uid, 'member')
  ON CONFLICT DO NOTHING;
  RETURN v_crew;
END;
$$;

REVOKE ALL ON FUNCTION public.join_crew_by_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_crew_by_code(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.join_crew_by_code(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_member_of(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_member_of(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_owner_of(uuid)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_owner_of(uuid)  FROM anon;
GRANT  EXECUTE ON FUNCTION public.is_member_of(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_owner_of(uuid)  TO authenticated;

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crew members can read realtime messages" ON realtime.messages;
CREATE POLICY "crew members can read realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'messages:%' THEN
      public.is_member_of(
        NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
      )
    ELSE false
  END
);