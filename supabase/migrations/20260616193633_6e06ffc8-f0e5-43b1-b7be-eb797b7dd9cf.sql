
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id uuid NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (length(text) > 0 AND length(text) <= 2000),
  reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_crew_created_idx ON public.messages (crew_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crew members read messages" ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_member_of(crew_id));

CREATE POLICY "crew members post messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(crew_id) AND author_id = auth.uid());

CREATE POLICY "crew members update messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (public.is_member_of(crew_id))
  WITH CHECK (public.is_member_of(crew_id));

CREATE POLICY "authors delete own messages" ON public.messages
  FOR DELETE TO authenticated
  USING (author_id = auth.uid());

CREATE TRIGGER messages_set_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
ALTER TABLE public.attendance REPLICA IDENTITY FULL;
