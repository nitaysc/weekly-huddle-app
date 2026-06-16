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
