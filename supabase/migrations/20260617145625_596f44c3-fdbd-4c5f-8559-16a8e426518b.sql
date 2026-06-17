
CREATE TABLE public.plan_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tagline TEXT,
  image_url TEXT,
  location TEXT,
  duration INTEGER NOT NULL DEFAULT 60,
  difficulty TEXT NOT NULL DEFAULT 'Medium',
  equipment TEXT[] NOT NULL DEFAULT '{}',
  warmup TEXT[] NOT NULL DEFAULT '{}',
  workout JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  color_var TEXT NOT NULL DEFAULT 'boxing',
  start_time TEXT NOT NULL DEFAULT '18:30',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_templates TO authenticated;
GRANT ALL ON public.plan_templates TO service_role;

ALTER TABLE public.plan_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crew members can view templates"
  ON public.plan_templates FOR SELECT TO authenticated
  USING (public.is_member_of(crew_id));

CREATE POLICY "Crew owners can insert templates"
  ON public.plan_templates FOR INSERT TO authenticated
  WITH CHECK (public.is_owner_of(crew_id) AND created_by = auth.uid());

CREATE POLICY "Crew owners can update templates"
  ON public.plan_templates FOR UPDATE TO authenticated
  USING (public.is_owner_of(crew_id))
  WITH CHECK (public.is_owner_of(crew_id));

CREATE POLICY "Crew owners can delete templates"
  ON public.plan_templates FOR DELETE TO authenticated
  USING (public.is_owner_of(crew_id));

CREATE TRIGGER set_plan_templates_updated_at
  BEFORE UPDATE ON public.plan_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
