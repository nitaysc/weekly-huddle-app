import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface NotifyMessageInput {
  crewId: string;
  text: string;
}

interface NotifyRsvpInput {
  sessionId: string;
  status: "going" | "maybe" | "out";
}

/** Fan out a push to every crew member except the author when a chat message is sent. */
export const notifyCrewMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: NotifyMessageInput) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Get author display name
    const { data: me } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();

    // Get crew name + recipients (members of this crew, excluding the sender)
    const { data: crew } = await supabase
      .from("crews")
      .select("name")
      .eq("id", data.crewId)
      .maybeSingle();

    const { data: members } = await supabase
      .from("crew_members")
      .select("user_id")
      .eq("crew_id", data.crewId);

    const targets = (members ?? [])
      .map((m) => m.user_id as string)
      .filter((id) => id !== userId);

    if (targets.length === 0) return { sent: 0 };

    const { sendOneSignalToUsers } = await import("@/lib/onesignal.server");
    const author = me?.display_name ?? "Someone";
    const preview = data.text.length > 120 ? data.text.slice(0, 117) + "…" : data.text;
    await sendOneSignalToUsers({
      externalUserIds: targets,
      headings: `${author} in ${crew?.name ?? "your crew"}`,
      contents: preview,
      url: "/crew",
      data: { kind: "message", crewId: data.crewId },
    });
    return { sent: targets.length };
  });

/** Notify crew when a member updates their RSVP. */
export const notifyRsvpChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: NotifyRsvpInput) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: session } = await supabase
      .from("sessions")
      .select("crew_id, sport_id, session_date")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session) return { sent: 0 };

    const { data: me } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();

    const { data: members } = await supabase
      .from("crew_members")
      .select("user_id")
      .eq("crew_id", session.crew_id);

    const targets = (members ?? [])
      .map((m) => m.user_id as string)
      .filter((id) => id !== userId);

    if (targets.length === 0) return { sent: 0 };

    const verb = data.status === "going" ? "is in" : data.status === "maybe" ? "might come" : "can't make it";
    const sportLabel = ({
      boxing: "Boxing", cali: "Calisthenics", basket: "Basketball", volley: "Volleyball", rest: "Rest day",
    } as Record<string, string>)[session.sport_id] ?? "session";

    const { sendOneSignalToUsers } = await import("@/lib/onesignal.server");
    await sendOneSignalToUsers({
      externalUserIds: targets,
      headings: `${me?.display_name ?? "A friend"} ${verb}`,
      contents: `${sportLabel} · ${session.session_date}`,
      url: `/activity/${session.sport_id}`,
      data: { kind: "rsvp", sessionId: data.sessionId, status: data.status },
    });
    return { sent: targets.length };
  });

/** Notify the crew about an upcoming session. Used by the reminder cron. */
export const remindUpcomingSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sessionId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: session } = await supabase
      .from("sessions")
      .select("crew_id, sport_id, session_date, starts_at")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session || session.sport_id === "rest") return { sent: 0 };

    const { data: members } = await supabase
      .from("crew_members")
      .select("user_id")
      .eq("crew_id", session.crew_id);
    const targets = (members ?? []).map((m) => m.user_id as string);
    if (targets.length === 0) return { sent: 0 };

    const sportLabel = ({
      boxing: "Boxing", cali: "Calisthenics", basket: "Basketball", volley: "Volleyball",
    } as Record<string, string>)[session.sport_id] ?? "Session";

    const { sendOneSignalToUsers } = await import("@/lib/onesignal.server");
    await sendOneSignalToUsers({
      externalUserIds: targets,
      headings: `${sportLabel} tonight`,
      contents: `Don't forget to RSVP. Starts ${new Date(session.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      url: `/activity/${session.sport_id}`,
      data: { kind: "reminder", sessionId: data.sessionId },
    });
    return { sent: targets.length };
  });
