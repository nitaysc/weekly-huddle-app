// Server-only OneSignal sender. Imported lazily from .functions.ts handlers.
const ONESIGNAL_APP_ID = "24ce68cf-30f4-4422-a391-11b83eeb05bc";

interface SendArgs {
  /** Supabase user IDs to target (mapped to OneSignal external_id) */
  externalUserIds: string[];
  headings: string;
  contents: string;
  url?: string;
  data?: Record<string, unknown>;
  /** Collapse key — newer notifications replace older ones with the same key */
  collapseId?: string;
}

export async function sendOneSignalToUsers(args: SendArgs): Promise<{ ok: boolean; status: number; body: string }> {
  const key = process.env.ONESIGNAL_REST_API_KEY;
  if (!key) throw new Error("ONESIGNAL_REST_API_KEY missing");
  if (args.externalUserIds.length === 0) return { ok: true, status: 0, body: "no-targets" };

  const payload: Record<string, unknown> = {
    app_id: ONESIGNAL_APP_ID,
    include_aliases: { external_id: args.externalUserIds },
    target_channel: "push",
    headings: { en: args.headings },
    contents: { en: args.contents },
    // Reduce Chrome's "site may be sending spam" flagging:
    priority: 10,
    ttl: 86400,
    // Use site favicon as the notification icon so Chrome shows a branded image
    chrome_web_icon: "https://weekly-huddle-app.lovable.app/favicon.ico",
    chrome_web_badge: "https://weekly-huddle-app.lovable.app/favicon.ico",
  };
  if (args.url) payload.url = args.url;
  if (args.data) payload.data = args.data;
  if (args.collapseId) {
    // Both fields exist for cross-platform collapsing
    payload.web_push_topic = args.collapseId;
    payload.collapse_id = args.collapseId;
  }

  const res = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${key}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  if (!res.ok) console.error("[OneSignal] send failed", res.status, body);
  return { ok: res.ok, status: res.status, body };
}
