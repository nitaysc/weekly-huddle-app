import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Public cron endpoint: pings every 15 minutes, sends a "session tonight" push
// to any crew whose session starts in the next ~2 hours and hasn't been reminded yet.
export const Route = createFileRoute("/api/public/hooks/session-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("apikey") || request.headers.get("authorization")?.replace("Bearer ", "");
        if (!authHeader || authHeader !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
        }

        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const now = new Date();
        const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);

        const { data: sessions, error } = await supabase
          .from("sessions")
          .select("id, crew_id, sport_id, session_date, starts_at, notes")
          .gte("starts_at", now.toISOString())
          .lte("starts_at", inTwoHours.toISOString())
          .neq("sport_id", "rest");
        if (error) {
          console.error(error);
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        const { sendOneSignalToUsers } = await import("@/lib/onesignal.server");
        let sentTotal = 0;
        for (const s of sessions ?? []) {
          // Skip if already reminded (we mark notes with "[reminded]" suffix)
          if ((s.notes ?? "").includes("[reminded]")) continue;

          const { data: members } = await supabase
            .from("crew_members")
            .select("user_id")
            .eq("crew_id", s.crew_id);
          const targets = (members ?? []).map((m: any) => m.user_id as string);
          if (targets.length === 0) continue;

          const sportLabel = ({
            boxing: "Boxing", cali: "Calisthenics", basket: "Basketball", volley: "Volleyball",
          } as Record<string, string>)[s.sport_id] ?? "Session";

          const t = new Date(s.starts_at);
          await sendOneSignalToUsers({
            externalUserIds: targets,
            headings: `${sportLabel} starting soon`,
            contents: `Today at ${t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — tap to RSVP`,
            url: `/activity/${s.sport_id}`,
            data: { kind: "reminder", sessionId: s.id },
          });
          sentTotal += targets.length;

          await supabase
            .from("sessions")
            .update({ notes: ((s.notes ?? "") + " [reminded]").trim() })
            .eq("id", s.id);
        }

        return Response.json({ ok: true, sessions: sessions?.length ?? 0, sent: sentTotal });
      },
    },
  },
});
