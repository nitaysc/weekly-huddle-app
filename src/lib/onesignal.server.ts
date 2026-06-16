// Server-only OneSignal sender. Imported lazily from .functions.ts handlers.
const ONESIGNAL_APP_ID = "24ce68cf-30f4-4422-a391-11b83eeb05bc";

interface SendArgs {
  /** Supabase user IDs to target (mapped to OneSignal external_id) */
  externalUserIds: string[];
  headings: string;
  contents: string;
  url?: string;
  data?: Record<string, unknown>;
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
  };
  if (args.url) payload.url = args.url;
  if (args.data) payload.data = args.data;

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
