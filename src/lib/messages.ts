import { supabase } from "@/integrations/supabase/client";

export interface MessageRow {
  id: string;
  crew_id: string;
  author_id: string;
  text: string;
  reactions: Record<string, string[]>; // emoji -> array of user_ids
  created_at: string;
  updated_at: string;
}

export async function fetchMessages(crewId: string): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("crew_id", crewId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((m: any) => ({
    ...m,
    reactions: (m.reactions ?? {}) as Record<string, string[]>,
  }));
}

export async function sendMessage(crewId: string, text: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { error } = await supabase
    .from("messages")
    .insert({ crew_id: crewId, author_id: u.user.id, text });
  if (error) throw error;
}

export async function toggleReaction(msg: MessageRow, emoji: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const uid = u.user.id;
  const next = { ...(msg.reactions ?? {}) } as Record<string, string[]>;
  const arr = next[emoji] ? [...next[emoji]] : [];
  const idx = arr.indexOf(uid);
  if (idx >= 0) arr.splice(idx, 1);
  else arr.push(uid);
  if (arr.length === 0) delete next[emoji];
  else next[emoji] = arr;
  const { error } = await supabase
    .from("messages")
    .update({ reactions: next })
    .eq("id", msg.id);
  if (error) throw error;
}
