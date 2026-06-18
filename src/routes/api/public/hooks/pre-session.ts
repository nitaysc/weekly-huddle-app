import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { generateText } from "ai";

// Pre-session pep talk — runs every 15 min and fires ~1h before a session starts.
// Marks the session with "[peptalk]" tag so it only sends once.
export const Route = createFileRoute("/api/public/hooks/pre-session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth =
          request.headers.get("apikey") ||
          request.headers.get("authorization")?.replace("Bearer ", "");
        if (!auth || auth !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
        }

        const admin = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const now = new Date();
        const inHour = new Date(now.getTime() + 65 * 60 * 1000);

        const { data: sessions } = await admin
          .from("sessions")
          .select("id, crew_id, sport_id, starts_at, notes, overrides")
          .gte("starts_at", now.toISOString())
          .lte("starts_at", inHour.toISOString())
          .neq("sport_id", "rest");
        if (!sessions?.length) return Response.json({ ok: true, sent: 0 });

        const key = process.env.LOVABLE_API_KEY!;
        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");
        const { sendOneSignalToUsers } = await import("@/lib/onesignal.server");

        let sent = 0;
        for (const s of sessions) {
          if ((s.notes ?? "").includes("[peptalk]")) continue;
          const sportName =
            (s.overrides as { name?: string } | null)?.name ||
            ({ boxing: "Boxing", cali: "Calisthenics", basket: "Basketball", volley: "Volleyball", custom: "Custom" } as Record<string, string>)[s.sport_id] ||
            "Session";

          let body = `${sportName} in an hour — let's go.`;
          try {
            const r = await generateText({
              model,
              prompt: `Write a short (max 110 chars), high-energy pre-workout pep talk for a crew about to do ${sportName} in 1 hour. No emojis, no quotes. One sentence.`,
            });
            body = r.text.replace(/[\n"]+/g, " ").trim().slice(0, 140);
          } catch (e) {
            console.warn("peptalk ai err", e);
          }

          const { data: members } = await admin
            .from("crew_members")
            .select("user_id")
            .eq("crew_id", s.crew_id);
          const targets = (members ?? []).map((m) => m.user_id as string);
          if (!targets.length) continue;

          await sendOneSignalToUsers({
            externalUserIds: targets,
            headings: `${sportName} in 1h`,
            contents: body,
            url: `/activity/${s.sport_id}`,
            data: { kind: "peptalk", sessionId: s.id },
            collapseId: `peptalk-${s.id}`,
          }).catch((e) => console.warn("push:", e));

          await admin
            .from("sessions")
            .update({ notes: ((s.notes ?? "") + " [peptalk]").trim() })
            .eq("id", s.id);
          sent += targets.length;
        }

        return Response.json({ ok: true, sent });
      },
    },
  },
});
