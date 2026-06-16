import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Send a test push notification to the calling user only. */
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { sendOneSignalToUsers } = await import("@/lib/onesignal.server");
    const res = await sendOneSignalToUsers({
      externalUserIds: [userId],
      headings: "Test push 🚀",
      contents: "If you're seeing this, push notifications work!",
      url: "/crew",
      data: { kind: "test" },
    });
    return res;
  });

interface BroadcastInput {
  crewId: string;
  title: string;
  body: string;
  /** Optional path/URL to deep-link to (defaults to /crew). */
  url?: string;
  /** Include the sender in the broadcast (defaults to false). */
  includeSelf?: boolean;
}

/** Admin/owner broadcast — push every crew member. */
export const sendCrewBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: BroadcastInput) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Only crew owners can broadcast.
    const { data: me } = await supabase
      .from("crew_members")
      .select("role")
      .eq("crew_id", data.crewId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!me || me.role !== "owner") {
      throw new Error("Only the crew owner can broadcast");
    }

    const { data: members } = await supabase
      .from("crew_members")
      .select("user_id")
      .eq("crew_id", data.crewId);

    const targets = (members ?? [])
      .map((m) => m.user_id as string)
      .filter((id) => data.includeSelf || id !== userId);

    if (targets.length === 0) return { ok: true, status: 0, body: "no-targets", recipients: 0 };

    const { sendOneSignalToUsers } = await import("@/lib/onesignal.server");
    const title = (data.title || "").trim().slice(0, 60) || "Crew update";
    const body = (data.body || "").trim().slice(0, 240) || "Tap to open the crew.";
    const res = await sendOneSignalToUsers({
      externalUserIds: targets,
      headings: title,
      contents: body,
      url: data.url ?? "/crew",
      data: { kind: "broadcast", crewId: data.crewId },
      collapseId: `crew-${data.crewId}-broadcast`,
    });
    return { ...res, targeted: targets.length };
  });
