import { supabase } from "@/integrations/supabase/client";
import { sessionTime, sportFor, type SportId } from "@/lib/data";

export type ScheduleSportId = SportId | "rest";

export interface SessionOverrides {
  name?: string;
  tagline?: string;
  location?: string;
  duration?: number;
  difficulty?: "Easy" | "Medium" | "Hard";
  equipment?: string[];
  warmup?: string[];
  workout?: Array<{ title: string; detail: string }>;
  notes?: string;
  startTime?: string; // "HH:MM"
}

export interface SessionRow {
  id: string;
  crew_id: string;
  session_date: string; // YYYY-MM-DD
  sport_id: string;
  starts_at: string;
  notes: string | null;
  is_override?: boolean;
  overrides?: SessionOverrides;
}

export type AttendanceStatus = "going" | "maybe" | "out";

export interface AttendanceRow {
  id: string;
  session_id: string;
  user_id: string;
  status: AttendanceStatus;
  updated_at: string;
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Ensure a session row exists for a given date in the active crew. Returns it. */
export async function ensureSession(crewId: string, date: Date): Promise<SessionRow | null> {
  const sId = sportFor(date);
  if (!sId) return null;
  const key = toDateKey(date);
  const { data: existing, error: fetchErr } = await supabase
    .from("sessions")
    .select("*")
    .eq("crew_id", crewId)
    .eq("session_date", key)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (existing) return existing as SessionRow;

  const starts = sessionTime(date).toISOString();
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      crew_id: crewId,
      session_date: key,
      sport_id: sId,
      starts_at: starts,
    })
    .select()
    .single();
  if (error) {
    // Race: another insert won. Re-fetch.
    const { data: again } = await supabase
      .from("sessions")
      .select("*")
      .eq("crew_id", crewId)
      .eq("session_date", key)
      .maybeSingle();
    if (again) return again as SessionRow;
    throw error;
  }
  return data as SessionRow;
}

export async function fetchAttendance(sessionId: string): Promise<AttendanceRow[]> {
  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("session_id", sessionId);
  if (error) throw error;
  return (data ?? []) as AttendanceRow[];
}

export async function setMyAttendance(sessionId: string, status: AttendanceStatus) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { error } = await supabase
    .from("attendance")
    .upsert(
      { session_id: sessionId, user_id: u.user.id, status },
      { onConflict: "session_id,user_id" },
    );
  if (error) throw error;
  // Fire-and-forget push to crew
  import("@/lib/notify.functions").then(({ notifyRsvpChange }) =>
    notifyRsvpChange({ data: { sessionId, status } }).catch((e) => console.warn("notify:", e)),
  );
}

/** Bulk-load sessions for a date range. */
export async function fetchSessionsRange(crewId: string, start: Date, end: Date) {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("crew_id", crewId)
    .gte("session_date", toDateKey(start))
    .lte("session_date", toDateKey(end));
  if (error) throw error;
  return (data ?? []) as SessionRow[];
}

export function sportIdOf(row: { sport_id: string }): SportId {
  return row.sport_id as SportId;
}

/** Owner-only: set the sport for a given date (creates or updates the session row). */
export async function setSchedule(
  crewId: string,
  date: Date,
  sportId: ScheduleSportId,
): Promise<SessionRow> {
  const key = toDateKey(date);
  const starts = sessionTime(date).toISOString();
  const { data, error } = await supabase
    .from("sessions")
    .upsert(
      {
        crew_id: crewId,
        session_date: key,
        sport_id: sportId,
        starts_at: starts,
        is_override: true,
      },
      { onConflict: "crew_id,session_date" },
    )
    .select()
    .single();
  if (error) throw error;
  return data as SessionRow;
}

/** Owner-only: clear an override and fall back to the default rotation. */
export async function clearSchedule(crewId: string, date: Date) {
  const key = toDateKey(date);
  const { error } = await supabase
    .from("sessions")
    .delete()
    .eq("crew_id", crewId)
    .eq("session_date", key);
  if (error) throw error;
}

/** Resolved sport for a day: override row wins, else default rotation, else null. */
export function resolvedSportFor(
  date: Date,
  sessionsRows: SessionRow[] | undefined,
): { sportId: ScheduleSportId | null; row: SessionRow | null } {
  const key = toDateKey(date);
  const row = sessionsRows?.find((r) => r.session_date === key) ?? null;
  if (row) {
    return { sportId: row.sport_id as ScheduleSportId, row };
  }
  const def = sportFor(date);
  return { sportId: def ?? null, row: null };
}
