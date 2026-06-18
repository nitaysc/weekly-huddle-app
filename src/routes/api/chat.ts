import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  streamText,
  tool,
  stepCountIs,
  type UIMessage,
  type FileUIPart,
} from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import type { Database } from "@/integrations/supabase/types";

const ONE_YEAR = 60 * 60 * 24 * 365;

type ChatBody = {
  messages?: UIMessage[];
  threadId?: string;
  crewId?: string | null;
};

function getAccessToken(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  if (h.toLowerCase().startsWith("bearer ")) return h.slice(7).trim() || null;
  return null;
}

async function uploadDataUrlToPlanImages(
  admin: ReturnType<typeof createClient<Database>>,
  userId: string,
  dataUrl: string,
  mediaType: string,
): Promise<string | null> {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  const mime = m[1] || mediaType || "image/jpeg";
  const ext = mime.split("/")[1]?.split("+")[0] || "jpg";
  const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  const path = `${userId}/chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await admin.storage.from("plan-images").upload(path, bytes, {
    contentType: mime,
    upsert: false,
  });
  if (error) {
    console.error("plan-images upload failed", error);
    return null;
  }
  const { data: signed } = await admin.storage.from("plan-images").createSignedUrl(path, ONE_YEAR);
  return signed?.signedUrl ?? null;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const token = getAccessToken(request);
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: `Bearer ${token}` } },
          },
        );
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        const admin = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const body = (await request.json()) as ChatBody;
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const threadId = body.threadId;
        if (!threadId) return new Response("threadId required", { status: 400 });

        // Verify thread ownership
        const { data: thread } = await supabase
          .from("chat_threads")
          .select("id, crew_id, title")
          .eq("id", threadId)
          .maybeSingle();
        if (!thread) return new Response("Thread not found", { status: 404 });
        const crewId = thread.crew_id ?? body.crewId ?? null;

        // Check owner status for tool gating
        let isOwner = false;
        if (crewId) {
          const { data: row } = await supabase
            .from("crew_members")
            .select("role")
            .eq("crew_id", crewId)
            .eq("user_id", userId)
            .maybeSingle();
          isOwner = row?.role === "owner";
        }

        // Lift any inline base64 images from the latest user message into storage,
        // replace with signed URLs so the model can ground tools on them.
        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        const uploadedImageUrls: string[] = [];
        if (lastUser && Array.isArray(lastUser.parts)) {
          for (const p of lastUser.parts) {
            const fp = p as FileUIPart;
            if (fp?.type === "file" && typeof fp.url === "string" && fp.url.startsWith("data:")) {
              const url = await uploadDataUrlToPlanImages(
                admin,
                userId,
                fp.url,
                fp.mediaType ?? "image/jpeg",
              );
              if (url) {
                fp.url = url;
                if ((fp.mediaType ?? "").startsWith("image/")) uploadedImageUrls.push(url);
              }
            } else if (fp?.type === "file" && typeof fp.url === "string" && (fp.mediaType ?? "").startsWith("image/")) {
              uploadedImageUrls.push(fp.url);
            }
          }
        }

        // Persist the latest user message immediately (so it survives a reload).
        if (lastUser) {
          await admin.from("chat_messages").insert({
            thread_id: threadId,
            role: "user",
            parts: lastUser.parts as unknown as Database["public"]["Tables"]["chat_messages"]["Insert"]["parts"],
            sdk_message_id: lastUser.id,
          });
          // Bump thread updated_at + auto-title from first user message
          const update: { updated_at: string; title?: string } = { updated_at: new Date().toISOString() };
          if (thread.title === "New chat") {
            const firstText = (lastUser.parts as Array<{ type: string; text?: string }>)
              ?.find((p) => p.type === "text")?.text;
            if (firstText) update.title = firstText.slice(0, 60);
          }
          await admin.from("chat_threads").update(update).eq("id", threadId);
        }

        // --- Tools ---
        const SportEnum = z.enum(["boxing", "cali", "basket", "volley", "rest", "custom"]);
        const setDayPlanTool = tool({
          description:
            "Owner only. Set the workout plan for a single date in the crew's schedule. " +
            "Use 'rest' for a rest day or 'custom' with overrides for a fully custom session (provide name, tagline, duration, equipment, workout, image_url, etc).",
          inputSchema: z.object({
            date: z.string().describe("Date in YYYY-MM-DD format"),
            sport: SportEnum,
            name: z.string().optional(),
            tagline: z.string().optional(),
            location: z.string().optional(),
            duration: z.number().optional(),
            difficulty: z.enum(["Easy", "Medium", "Hard"]).optional(),
            equipment: z.array(z.string()).optional(),
            warmup: z.array(z.string()).optional(),
            workout: z.array(z.object({ title: z.string(), detail: z.string() })).optional(),
            notes: z.string().optional(),
            startTime: z.string().optional().describe("HH:MM"),
            image_url: z.string().optional().describe("Cover image URL (use one returned from an uploaded picture)"),
            colorVar: z.enum(["boxing", "cali", "basket", "volley", "primary"]).optional(),
            description: z.string().optional(),
          }),
          execute: async (input) => {
            if (!crewId) return { error: "You're not in a crew yet." };
            if (!isOwner) return { error: "Only the crew owner can change the plan." };

            const date = new Date(input.date + "T00:00:00");
            if (isNaN(date.getTime())) return { error: "Invalid date" };
            const [hh, mm] = (input.startTime ?? "18:30").split(":").map(Number);
            date.setHours(hh || 18, mm || 30, 0, 0);

            const overrides: Record<string, unknown> = {};
            for (const k of ["name", "tagline", "location", "duration", "difficulty", "equipment", "warmup", "workout", "notes", "startTime", "colorVar", "description"] as const) {
              if (input[k] !== undefined) overrides[k] = input[k];
            }
            if (input.image_url) overrides.image = input.image_url;

            const { error } = await admin.from("sessions").upsert(
              {
                crew_id: crewId,
                session_date: input.date,
                sport_id: input.sport,
                starts_at: date.toISOString(),
                is_override: true,
                overrides: overrides as Database["public"]["Tables"]["sessions"]["Insert"]["overrides"],
              },
              { onConflict: "crew_id,session_date" },
            );
            if (error) return { error: error.message };

            // Push to crew members
            const { data: members } = await admin
              .from("crew_members")
              .select("user_id")
              .eq("crew_id", crewId);
            const targets = (members ?? []).map((m) => m.user_id as string).filter((id) => id !== userId);
            if (targets.length) {
              const { sendOneSignalToUsers } = await import("@/lib/onesignal.server");
              const label = input.name ?? (input.sport === "rest" ? "Rest day" : input.sport);
              await sendOneSignalToUsers({
                externalUserIds: targets,
                headings: "Plan updated by AI",
                contents: `${input.date}: ${label}`,
                url: "/plan",
                data: { kind: "plan-changed", date: input.date },
                collapseId: `plan-${input.date}`,
              }).catch((e) => console.warn("push:", e));
            }
            return { ok: true, date: input.date, sport: input.sport };
          },
        });

        const savePlanTemplateTool = tool({
          description:
            "Owner only. Save a custom workout as a reusable plan template the owner can apply on any future day.",
          inputSchema: z.object({
            name: z.string(),
            tagline: z.string().optional(),
            image_url: z.string().optional(),
            location: z.string().optional(),
            duration: z.number().optional(),
            difficulty: z.enum(["Easy", "Medium", "Hard"]).optional(),
            equipment: z.array(z.string()).optional(),
            warmup: z.array(z.string()).optional(),
            workout: z.array(z.object({ title: z.string(), detail: z.string() })).optional(),
            notes: z.string().optional(),
            colorVar: z.enum(["boxing", "cali", "basket", "volley", "primary"]).optional(),
            startTime: z.string().optional(),
          }),
          execute: async (input) => {
            if (!crewId) return { error: "No crew." };
            if (!isOwner) return { error: "Only the owner can save plan templates." };
            const { data, error } = await admin
              .from("plan_templates")
              .insert({
                crew_id: crewId,
                created_by: userId,
                name: input.name,
                tagline: input.tagline ?? null,
                image_url: input.image_url ?? null,
                location: input.location ?? null,
                duration: input.duration ?? 60,
                difficulty: input.difficulty ?? "Medium",
                equipment: input.equipment ?? [],
                warmup: input.warmup ?? [],
                workout: (input.workout ?? []) as Database["public"]["Tables"]["plan_templates"]["Insert"]["workout"],
                notes: input.notes ?? null,
                color_var: input.colorVar ?? "primary",
                start_time: input.startTime ?? "18:30",
              })
              .select("id, name")
              .single();
            if (error) return { error: error.message };
            return { ok: true, id: data.id, name: data.name };
          },
        });

        const draftCrewAnnouncementTool = tool({
          description:
            "Owner only. Post a short announcement message into the crew chat from the owner.",
          inputSchema: z.object({ text: z.string().min(1).max(1500) }),
          execute: async (input) => {
            if (!crewId) return { error: "No crew." };
            if (!isOwner) return { error: "Only the owner can post announcements." };
            const { error } = await admin
              .from("messages")
              .insert({ crew_id: crewId, author_id: userId, text: `📣 ${input.text}` });
            if (error) return { error: error.message };
            const { data: members } = await admin
              .from("crew_members")
              .select("user_id")
              .eq("crew_id", crewId);
            const targets = (members ?? []).map((m) => m.user_id as string).filter((id) => id !== userId);
            if (targets.length) {
              const { sendOneSignalToUsers } = await import("@/lib/onesignal.server");
              await sendOneSignalToUsers({
                externalUserIds: targets,
                headings: "Crew announcement",
                contents: input.text.slice(0, 140),
                url: "/crew",
                data: { kind: "announcement", crewId },
              }).catch(() => {});
            }
            return { ok: true };
          },
        });

        const suggestPlanChangeTool = tool({
          description:
            "Any member. Post a plan-change suggestion into the crew chat for the owner to review and approve.",
          inputSchema: z.object({
            date: z.string().describe("YYYY-MM-DD"),
            suggestion: z.string().min(1).max(800),
          }),
          execute: async (input) => {
            if (!crewId) return { error: "No crew." };
            const { error } = await admin.from("messages").insert({
              crew_id: crewId,
              author_id: userId,
              text: `💡 Plan suggestion for ${input.date}: ${input.suggestion}`,
            });
            if (error) return { error: error.message };
            return { ok: true };
          },
        });

        const listUpcomingPlanTool = tool({
          description: "List the next 14 days of the crew's planned sessions (sport + date + notes).",
          inputSchema: z.object({}),
          execute: async () => {
            if (!crewId) return { error: "No crew." };
            const today = new Date();
            const end = new Date(today);
            end.setDate(end.getDate() + 14);
            const fmt = (d: Date) => d.toISOString().slice(0, 10);
            const { data, error } = await admin
              .from("sessions")
              .select("session_date, sport_id, starts_at, overrides")
              .eq("crew_id", crewId)
              .gte("session_date", fmt(today))
              .lte("session_date", fmt(end))
              .order("session_date");
            if (error) return { error: error.message };
            return { sessions: data ?? [] };
          },
        });

        const todayISO = new Date().toISOString().slice(0, 10);
        const systemPrompt = `You are Coach, the AI inside the Weekly Huddle workout crew app.
Today is ${todayISO}. The user is ${isOwner ? "the OWNER of the crew" : "a regular CREW MEMBER"}.
The crew schedules sessions on Sun–Thu (Fri/Sat are rest in Israel) with a rotating extra rest day.

You help with:
- Planning the week (sports per day, rest days, custom sessions). OWNER ONLY for actual writes — use the set_day_plan tool. Always confirm the date and intent before calling, then call the tool. Don't ask the same thing twice.
- Custom days: ask short questions for missing essentials (name, tagline, equipment, workout list, duration), then call set_day_plan with sport="custom". If the user attached an image, you'll see an image_url in their message — pass it as image_url to the tool.
- Saving a custom day as a reusable template via save_plan_template.
- Members can use suggest_plan_change to propose a change to the owner.
- Crew announcements (owner): use draft_crew_announcement when the owner asks to "tell the crew" / "announce".
- Workout tips, motivation, technique questions: answer directly, concise and warm.
${uploadedImageUrls.length ? `\nThe user just uploaded image(s). Use these URL(s) when setting a custom day cover: ${uploadedImageUrls.join(", ")}` : ""}

Style: short, friendly, no fluff. Use markdown lists when listing days. Use the user's words. Never invent dates — when the user says "tomorrow" or "next Friday", compute it from today's date above.`;

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system: systemPrompt,
          messages: await convertToModelMessages(messages),
          tools: {
            set_day_plan: setDayPlanTool,
            save_plan_template: savePlanTemplateTool,
            draft_crew_announcement: draftCrewAnnouncementTool,
            suggest_plan_change: suggestPlanChangeTool,
            list_upcoming_plan: listUpcomingPlanTool,
          },
          stopWhen: stepCountIs(50),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ responseMessage }) => {
            try {
              await admin.from("chat_messages").insert({
                thread_id: threadId,
                role: responseMessage.role,
                parts: responseMessage.parts as unknown as Database["public"]["Tables"]["chat_messages"]["Insert"]["parts"],
                sdk_message_id: responseMessage.id,
              });
              await admin
                .from("chat_threads")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", threadId);
            } catch (e) {
              console.error("persist assistant message failed", e);
            }
          },
        });
      },
    },
  },
});
