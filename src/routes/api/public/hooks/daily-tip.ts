import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { generateText } from "ai";

// Daily AI-generated workout tip / motivation push for every crew member.
// Run from pg_cron once a day (~7:30 local Israel time = 04:30 UTC).
export const Route = createFileRoute("/api/public/hooks/daily-tip")({
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

        const today = new Date().toISOString().slice(0, 10);
        const { data: crews } = await admin.from("crews").select("id, name");
        if (!crews?.length) return Response.json({ ok: true, sent: 0 });

        const key = process.env.LOVABLE_API_KEY!;
        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");
        const { sendOneSignalToUsers } = await import("@/lib/onesignal.server");

        let sent = 0;
        for (const c of crews) {
          const { data: today_session } = await admin
            .from("sessions")
            .select("sport_id, overrides")
            .eq("crew_id", c.id)
            .eq("session_date", today)
            .maybeSingle();
          const sportName = today_session
            ? (today_session.overrides as { name?: string } | null)?.name ||
              ({ boxing: "Boxing", cali: "Calisthenics", basket: "Basketball", volley: "Volleyball", rest: "Rest", custom: "Custom" } as Record<string, string>)[today_session.sport_id] ||
              "Session"
            : "Rest day";

          const prompt = `Write a short (max 110 chars), warm, motivating push notification for a workout crew. Today's session: ${sportName}. No emojis, no quotes, no markdown. One sentence.`;
          let body = "Show up. Even when it's raining.";
          try {
            const r = await generateText({ model, prompt });
            body = r.text.replace(/[\n"]+/g, " ").trim().slice(0, 140);
          } catch (e) {
            console.warn("daily-tip ai err", e);
          }

          const { data: members } = await admin
            .from("crew_members")
            .select("user_id")
            .eq("crew_id", c.id);
          const targets = (members ?? []).map((m) => m.user_id as string);
          if (!targets.length) continue;

          await sendOneSignalToUsers({
            externalUserIds: targets,
            headings: `Coach • ${c.name}`,
            contents: body,
            url: "/chat",
            data: { kind: "daily-tip" },
            collapseId: `daily-${today}-${c.id}`,
          }).catch((e) => console.warn("push:", e));
          sent += targets.length;
        }
        return Response.json({ ok: true, sent });
      },
    },
  },
});
