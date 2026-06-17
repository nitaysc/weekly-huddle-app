CREATE OR REPLACE FUNCTION public.create_crew(_name text, _invite_code text)
RETURNS public.crews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := NULLIF(trim(_name), '');
  v_invite_code text := upper(trim(_invite_code));
  v_crew public.crews;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Crew name is required';
  END IF;

  IF v_invite_code !~ '^[A-Z2-9]{6}$' THEN
    RAISE EXCEPTION 'Invite code must be 6 characters';
  END IF;

  INSERT INTO public.crews (name, invite_code, created_by)
  VALUES (v_name, v_invite_code, v_uid)
  RETURNING * INTO v_crew;

  INSERT INTO public.crew_members (crew_id, user_id, role)
  VALUES (v_crew.id, v_uid, 'owner')
  ON CONFLICT DO NOTHING;

  RETURN v_crew;
END;
$$;

REVOKE ALL ON FUNCTION public.create_crew(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_crew(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_crew(text, text) TO authenticated;
