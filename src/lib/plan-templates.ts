import { supabase } from "@/integrations/supabase/client";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export interface PlanTemplate {
  id: string;
  crew_id: string;
  created_by: string;
  name: string;
  tagline: string | null;
  image_url: string | null;
  location: string | null;
  duration: number;
  difficulty: "Easy" | "Medium" | "Hard";
  equipment: string[];
  warmup: string[];
  workout: Array<{ title: string; detail: string }>;
  notes: string | null;
  color_var: string;
  start_time: string;
  created_at: string;
  updated_at: string;
}

export type PlanTemplateInput = Omit<
  PlanTemplate,
  "id" | "created_by" | "created_at" | "updated_at"
>;

export async function fetchPlanTemplates(crewId: string): Promise<PlanTemplate[]> {
  const { data, error } = await supabase
    .from("plan_templates")
    .select("*")
    .eq("crew_id", crewId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PlanTemplate[];
}

export async function savePlanTemplate(input: PlanTemplateInput): Promise<PlanTemplate> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("plan_templates")
    .insert({ ...input, created_by: u.user.id })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as PlanTemplate;
}

export async function deletePlanTemplate(id: string) {
  const { error } = await supabase.from("plan_templates").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadPlanImage(file: File): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("Not signed in");

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${uid}/plan-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("plan-images")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) throw upErr;

  const { data: signed, error: signErr } = await supabase.storage
    .from("plan-images")
    .createSignedUrl(path, ONE_YEAR_SECONDS);
  if (signErr) throw signErr;

  return signed.signedUrl;
}
