import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

export interface PersistedMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  parts: Json;
}

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("chat_threads")
      .select("id, title, crew_id, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { crewId?: string | null; title?: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("chat_threads")
      .insert({
        user_id: context.userId,
        crew_id: data.crewId ?? null,
        title: data.title ?? "New chat",
      })
      .select("id, title, crew_id, updated_at")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("chat_threads")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const renameThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; title: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("chat_threads")
      .update({ title: data.title.slice(0, 80) })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const getThreadMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("chat_messages")
      .select("id, role, parts, sdk_message_id, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    const messages: PersistedMessage[] = (rows ?? []).map((r) => ({
      id: (r.sdk_message_id as string) || (r.id as string),
      role: r.role as PersistedMessage["role"],
      parts: (r.parts as unknown[]) ?? [],
    }));
    return messages;
  });
