import { supabase } from "@/integrations/supabase/client";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function uploadAvatar(file: File): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("Not signed in");

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${uid}/avatar-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) throw upErr;

  const { data: signed, error: signErr } = await supabase.storage
    .from("avatars")
    .createSignedUrl(path, ONE_YEAR_SECONDS);
  if (signErr) throw signErr;

  return signed.signedUrl;
}

export async function updateMyProfile(updates: {
  display_name?: string;
  avatar_url?: string | null;
}) {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("Not signed in");

  const patch: { display_name?: string; initials?: string; avatar_url?: string | null } = {};
  if (updates.display_name !== undefined) {
    const name = updates.display_name.trim() || "Friend";
    patch.display_name = name;
    patch.initials =
      (name.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || "FR");
  }
  if (updates.avatar_url !== undefined) patch.avatar_url = updates.avatar_url;

  const { error } = await supabase.from("profiles").update(patch).eq("id", uid);
  if (error) throw error;
}
