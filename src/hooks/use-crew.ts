import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const ACTIVE_CREW_KEY = "sf:activeCrewId";

export interface CrewRow {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export interface ProfileRow {
  id: string;
  display_name: string;
  initials: string;
  avatar_color: string;
  avatar_url: string | null;
}

export interface CrewMemberRow {
  user_id: string;
  crew_id: string;
  role: "owner" | "member";
  joined_at: string;
}

export function useMyCrews() {
  return useQuery({
    queryKey: ["my-crews"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return [];
      const { data, error } = await supabase
        .from("crew_members")
        .select("crew_id, role, crews:crew_id(id, name, invite_code, created_by, created_at)")
        .eq("user_id", uid);
      if (error) throw error;
      return (data ?? [])
        .map((r: any) => ({ ...r.crews, role: r.role as "owner" | "member" }))
        .filter(Boolean) as Array<CrewRow & { role: "owner" | "member" }>;
    },
  });
}

export function useActiveCrewId() {
  const [id, setId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACTIVE_CREW_KEY);
  });
  const set = useCallback((next: string | null) => {
    if (typeof window !== "undefined") {
      if (next) localStorage.setItem(ACTIVE_CREW_KEY, next);
      else localStorage.removeItem(ACTIVE_CREW_KEY);
    }
    setId(next);
  }, []);
  return [id, set] as const;
}

export function useActiveCrew() {
  const crews = useMyCrews();
  const [activeId, setActiveId] = useActiveCrewId();

  // Auto-pick the first crew if none selected
  useEffect(() => {
    if (!activeId && crews.data && crews.data.length > 0) {
      setActiveId(crews.data[0].id);
    }
    if (activeId && crews.data && !crews.data.some((c) => c.id === activeId)) {
      setActiveId(crews.data[0]?.id ?? null);
    }
  }, [crews.data, activeId, setActiveId]);

  const active = crews.data?.find((c) => c.id === activeId) ?? null;
  return {
    crews: crews.data ?? [],
    isLoading: crews.isLoading,
    activeCrew: active,
    activeCrewId: active?.id ?? null,
    setActiveCrewId: setActiveId,
  };
}

export function useCrewMembers(crewId: string | null | undefined) {
  return useQuery({
    queryKey: ["crew-members", crewId],
    enabled: !!crewId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crew_members")
        .select("user_id, crew_id, role, joined_at, profiles:user_id(id, display_name, initials, avatar_color)")
        .eq("crew_id", crewId!);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        user_id: r.user_id,
        crew_id: r.crew_id,
        role: r.role,
        joined_at: r.joined_at,
        profile: r.profiles as ProfileRow,
      }));
    },
  });
}

export function useMyProfile() {
  return useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.user.id)
        .maybeSingle();
      if (error) throw error;
      return data as ProfileRow | null;
    },
  });
}

export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function createCrew(name: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  // try a few invite codes until unique
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    const { data, error } = await supabase
      .from("crews")
      .insert({ name, invite_code: code, created_by: u.user.id })
      .select()
      .single();
    if (!error) return data as CrewRow;
    if (!String(error.message).toLowerCase().includes("duplicate")) throw error;
  }
  throw new Error("Could not generate invite code");
}

export async function joinCrewByCode(code: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const cleaned = code.trim().toUpperCase();
  const { data: crew, error } = await supabase
    .from("crews")
    .select("*")
    .eq("invite_code", cleaned)
    .maybeSingle();
  if (error) throw error;
  if (!crew) throw new Error("No crew found for that code");
  const { error: insErr } = await supabase
    .from("crew_members")
    .insert({ crew_id: crew.id, user_id: u.user.id, role: "member" });
  if (insErr && !String(insErr.message).toLowerCase().includes("duplicate")) throw insErr;
  return crew as CrewRow;
}

export function useSignOut() {
  const qc = useQueryClient();
  return useCallback(async () => {
    await qc.cancelQueries();
    qc.clear();
    localStorage.removeItem(ACTIVE_CREW_KEY);
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }, [qc]);
}
